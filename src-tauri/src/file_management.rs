use std::collections::HashMap;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::thread;

use anyhow::Result;
use base64::{engine::general_purpose, Engine as _};
use image::codecs::jpeg::JpegEncoder;
use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba};
use rayon::prelude::*;
use serde::Serialize;
use tauri::{Emitter, Manager};

use crate::image_processing::{
    get_all_adjustments_from_json, get_or_init_gpu_context, run_gpu_processing, Crop,
    GpuContext, ImageMetadata,
};
use crate::raw_processing;
use crate::AppState;

const THUMBNAIL_WIDTH: u32 = 720;

fn is_raw_file(path: &str) -> bool {
    let lower_path = path.to_lowercase();
    matches!(
        lower_path.split('.').last(),
        Some("arw") | Some("cr2") | Some("cr3") | Some("nef") | Some("dng") |
        Some("raf") | Some("orf") | Some("pef") | Some("rw2")
    )
}

#[tauri::command]
pub fn list_images_in_dir(path: String) -> Result<Vec<String>, String> {
    let entries = fs::read_dir(path)
        .map_err(|e| e.to_string())?
        .filter_map(std::result::Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            !path
                .file_name()
                .and_then(|s| s.to_str())
                .map_or(false, |s| s.starts_with('.'))
        })
        .filter(|path| path.is_file())
        .filter(|path| {
            path.extension()
                .and_then(|s| s.to_str())
                .map_or(false, |ext_lower| {
                    let ext = ext_lower.to_lowercase();
                    ["jpg", "jpeg", "png", "gif", "bmp", "arw", "cr2", "cr3", "nef", "dng", "raf", "orf", "pef", "rw2"].contains(&ext.as_str())
                })
        })
        .map(|path| path.to_string_lossy().into_owned())
        .collect();
    Ok(entries)
}

#[derive(Serialize, Debug)]
struct FolderNode {
    name: String,
    path: String,
    children: Vec<FolderNode>,
}

fn scan_dir_recursive(path: &Path) -> Result<Vec<FolderNode>, std::io::Error> {
    let mut children = Vec::new();
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(e) => return Err(e),
    };
    for entry in entries.filter_map(std::result::Result::ok) {
        let current_path = entry.path();
        let is_hidden = current_path
            .file_name()
            .and_then(|s| s.to_str())
            .map_or(false, |s| s.starts_with('.'));

        if current_path.is_dir() && !is_hidden {
            let sub_children = scan_dir_recursive(&current_path)?;
            let has_images = list_images_in_dir(current_path.to_string_lossy().into_owned())
                .map_or(false, |images| !images.is_empty());
            if !sub_children.is_empty() || has_images {
                children.push(FolderNode {
                    name: current_path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .into_owned(),
                    path: current_path.to_string_lossy().into_owned(),
                    children: sub_children,
                });
            }
        }
    }
    Ok(children)
}

fn get_folder_tree_sync(path: String) -> Result<FolderNode, String> {
    let root_path = Path::new(&path);
    let name = root_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned();
    let children = scan_dir_recursive(root_path).map_err(|e| e.to_string())?;
    Ok(FolderNode {
        name,
        path,
        children,
    })
}

#[tauri::command]
pub fn get_folder_tree(path: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let app_handle_clone = app_handle.clone();
    thread::spawn(move || match get_folder_tree_sync(path) {
        Ok(tree) => {
            if let Err(e) = app_handle_clone.emit("folder-tree-update", &tree) {
                eprintln!("Failed to emit folder-tree-update: {}", e);
            }
        }
        Err(e) => {
            if let Err(emit_err) = app_handle_clone.emit("folder-tree-error", &e) {
                eprintln!("Failed to emit folder-tree-error: {}", emit_err);
            }
        }
    });
    Ok(())
}

pub fn get_sidecar_path(image_path: &str) -> PathBuf {
    let path = PathBuf::from(image_path);
    let original_filename = path.file_name().unwrap_or_default().to_string_lossy();
    let new_filename = format!("{}.rrd", original_filename);
    path.with_file_name(new_filename)
}

fn generate_thumbnail_data(
    path_str: &str,
    gpu_context: Option<&GpuContext>,
) -> Result<DynamicImage> {
    let file_bytes = fs::read(path_str)?;

    // Step 1: Load a reasonably-sized preview image and get original dimensions.
    let (mut image_to_process, original_dims): (DynamicImage, (u32, u32)) = if is_raw_file(path_str)
    {
        let raw_info = rawloader::decode(&mut Cursor::new(&file_bytes))?;
        let crops = raw_info.crops;
        let full_width = raw_info.width as u32 - crops[3] as u32 - crops[1] as u32;
        let full_height = raw_info.height as u32 - crops[0] as u32 - crops[2] as u32;

        (
            raw_processing::develop_raw_thumbnail(&file_bytes)?,
            (full_width, full_height),
        )
    } else {
        // Load the full image into memory first for all non-RAW types
        let img = image::load_from_memory(&file_bytes)?;
        let original_dims = img.dimensions();

        // Then, if it's too large, create a smaller version for processing
        const PROCESSING_PREVIEW_DIM: u32 = 1280;
        let processing_base = if original_dims.0 > PROCESSING_PREVIEW_DIM {
            img.thumbnail(PROCESSING_PREVIEW_DIM, PROCESSING_PREVIEW_DIM)
        } else {
            img
        };
        (processing_base, original_dims)
    };

    let sidecar_path = get_sidecar_path(path_str);

    // Step 2: If there are adjustments, apply them.
    if let (Some(context), Ok(file_content)) = (gpu_context, fs::read_to_string(sidecar_path)) {
        if let Ok(metadata) = serde_json::from_str::<ImageMetadata>(&file_content) {
            if !metadata.adjustments.is_null() {
                // The adjustments (crop, masks) are relative to the original image dimensions.
                // We need to scale them for our smaller preview image.

                let (orig_w, orig_h) = original_dims;
                let (preview_w, preview_h) = image_to_process.dimensions();

                // a. Handle crop
                let crop_val = &metadata.adjustments["crop"];
                let original_crop = serde_json::from_value::<Crop>(crop_val.clone()).unwrap_or(
                    Crop {
                        x: 0.0,
                        y: 0.0,
                        width: orig_w as f64,
                        height: orig_h as f64,
                    },
                );

                let crop_scale_x = preview_w as f32 / orig_w as f32;
                let crop_scale_y = preview_h as f32 / orig_h as f32;

                let preview_crop_x = (original_crop.x as f32 * crop_scale_x).round() as u32;
                let preview_crop_y = (original_crop.y as f32 * crop_scale_y).round() as u32;
                let preview_crop_w = (original_crop.width as f32 * crop_scale_x).round() as u32;
                let preview_crop_h = (original_crop.height as f32 * crop_scale_y).round() as u32;

                let cropped_preview = image_to_process.crop_imm(
                    preview_crop_x,
                    preview_crop_y,
                    preview_crop_w,
                    preview_crop_h,
                );

                // b. Calculate scale for GPU adjustments
                let original_cropped_w = original_crop.width as u32;
                let scale = if original_cropped_w > 0 {
                    (cropped_preview.width() as f32 / original_cropped_w as f32).min(1.0)
                } else {
                    1.0
                };

                let gpu_adjustments = get_all_adjustments_from_json(&metadata.adjustments, scale);

                // c. Run GPU processing
                if let Ok(processed_pixels) =
                    run_gpu_processing(context, &cropped_preview, gpu_adjustments)
                {
                    let (width, height) = cropped_preview.dimensions();
                    if let Some(img_buf) =
                        ImageBuffer::<Rgba<u8>, Vec<u8>>::from_raw(width, height, processed_pixels)
                    {
                        image_to_process = DynamicImage::ImageRgba8(img_buf);
                    } else {
                        image_to_process = cropped_preview;
                    }
                } else {
                    image_to_process = cropped_preview;
                }
            }
        }
    }

    // Step 3: Return the final processed image, ready for encoding.
    Ok(image_to_process)
}

fn encode_thumbnail(image: &DynamicImage) -> Result<Vec<u8>> {
    let thumbnail = image.thumbnail(THUMBNAIL_WIDTH, THUMBNAIL_WIDTH);
    let mut buf = Cursor::new(Vec::new());
    let mut encoder = JpegEncoder::new_with_quality(&mut buf, 75);
    encoder.encode_image(&thumbnail.to_rgba8())?;
    Ok(buf.into_inner())
}

#[tauri::command]
pub fn generate_thumbnails(
    paths: Vec<String>,
    app_handle: tauri::AppHandle,
) -> Result<HashMap<String, String>, String> {
    let cache_dir = app_handle
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?;
    let thumb_cache_dir = cache_dir.join("thumbnails");
    if !thumb_cache_dir.exists() {
        fs::create_dir_all(&thumb_cache_dir).map_err(|e| e.to_string())?;
    }

    let state = app_handle.state::<AppState>();
    let gpu_context = get_or_init_gpu_context(&state).ok();

    let thumbnails: HashMap<String, String> = paths
        .par_iter()
        .filter_map(|path_str| {
            let original_path = Path::new(path_str);
            let sidecar_path = get_sidecar_path(path_str);

            let img_mod_time = fs::metadata(original_path)
                .ok()?
                .modified()
                .ok()?
                .duration_since(std::time::UNIX_EPOCH)
                .ok()?
                .as_secs();
            let sidecar_mod_time = fs::metadata(&sidecar_path)
                .ok()
                .and_then(|m| m.modified().ok())
                .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap().as_secs())
                .unwrap_or(0);

            let mut hasher = blake3::Hasher::new();
            hasher.update(path_str.as_bytes());
            hasher.update(&img_mod_time.to_le_bytes());
            hasher.update(&sidecar_mod_time.to_le_bytes());
            let hash = hasher.finalize();
            let cache_filename = format!("{}.jpg", hash.to_hex());
            let cache_path = thumb_cache_dir.join(cache_filename);

            if cache_path.exists() {
                if let Ok(data) = fs::read(&cache_path) {
                    let base64_str = general_purpose::STANDARD.encode(&data);
                    return Some((
                        path_str.clone(),
                        format!("data:image/jpeg;base64,{}", base64_str),
                    ));
                }
            }

            if let Ok(thumb_image) = generate_thumbnail_data(path_str, gpu_context.as_ref()) {
                if let Ok(thumb_data) = encode_thumbnail(&thumb_image) {
                    let _ = fs::write(&cache_path, &thumb_data);
                    let base64_str = general_purpose::STANDARD.encode(&thumb_data);
                    return Some((
                        path_str.clone(),
                        format!("data:image/jpeg;base64,{}", base64_str),
                    ));
                }
            }
            None
        })
        .collect();

    Ok(thumbnails)
}

#[tauri::command]
pub fn generate_thumbnails_progressive(
    paths: Vec<String>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let cache_dir = app_handle
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?;
    let thumb_cache_dir = cache_dir.join("thumbnails");
    if !thumb_cache_dir.exists() {
        fs::create_dir_all(&thumb_cache_dir).map_err(|e| e.to_string())?;
    }

    let app_handle_clone = app_handle.clone();
    let total_count = paths.len();
    let completed_count = Arc::new(AtomicUsize::new(0));

    thread::spawn(move || {
        let state = app_handle.state::<AppState>();
        let gpu_context = get_or_init_gpu_context(&state).ok();

        paths.par_iter().for_each(|path_str| {
            let result = (|| -> Option<String> {
                let original_path = Path::new(path_str);
                let sidecar_path = get_sidecar_path(path_str);

                let img_mod_time = fs::metadata(original_path)
                    .ok()?
                    .modified()
                    .ok()?
                    .duration_since(std::time::UNIX_EPOCH)
                    .ok()?
                    .as_secs();
                let sidecar_mod_time = fs::metadata(&sidecar_path)
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap().as_secs())
                    .unwrap_or(0);

                let mut hasher = blake3::Hasher::new();
                hasher.update(path_str.as_bytes());
                hasher.update(&img_mod_time.to_le_bytes());
                hasher.update(&sidecar_mod_time.to_le_bytes());
                let hash = hasher.finalize();
                let cache_filename = format!("{}.jpg", hash.to_hex());
                let cache_path = thumb_cache_dir.join(cache_filename);

                if cache_path.exists() {
                    if let Ok(data) = fs::read(&cache_path) {
                        let base64_str = general_purpose::STANDARD.encode(&data);
                        return Some(format!("data:image/jpeg;base64,{}", base64_str));
                    }
                }

                if let Ok(thumb_image) = generate_thumbnail_data(path_str, gpu_context.as_ref()) {
                    if let Ok(thumb_data) = encode_thumbnail(&thumb_image) {
                        let _ = fs::write(&cache_path, &thumb_data);
                        let base64_str = general_purpose::STANDARD.encode(&thumb_data);
                        return Some(format!("data:image/jpeg;base64,{}", base64_str));
                    }
                }
                None
            })();

            if let Some(thumbnail_data) = result {
                let _ = app_handle_clone.emit(
                    "thumbnail-generated",
                    serde_json::json!({ "path": path_str, "data": thumbnail_data }),
                );
            }

            let completed = completed_count.fetch_add(1, Ordering::Relaxed) + 1;
            let _ = app_handle_clone.emit(
                "thumbnail-progress",
                serde_json::json!({ "completed": completed, "total": total_count }),
            );
        });

        let _ = app_handle_clone.emit("thumbnail-generation-complete", true);
    });

    Ok(())
}