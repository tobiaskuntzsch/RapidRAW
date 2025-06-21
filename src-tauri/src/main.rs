#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod image_processing;
mod file_management;
mod gpu_processing;
mod raw_processing;

use std::io::Cursor;
use std::sync::Mutex;
use std::thread;
use std::fs;
use std::collections::HashMap;

use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba};
use tauri::{Manager, Emitter};
use base64::{Engine as _, engine::general_purpose};
use serde_json::Value;
use window_vibrancy::{apply_acrylic, apply_vibrancy, NSVisualEffectMaterial};
use serde::{Serialize, Deserialize};

use crate::image_processing::{
    get_all_adjustments_from_json, get_or_init_gpu_context, run_gpu_processing, GpuContext,
    ImageMetadata, AllAdjustments, process_and_get_dynamic_image,
};
use crate::file_management::get_sidecar_path;
use crate::raw_processing::DemosaicAlgorithm;

#[derive(Clone)]
pub struct PreviewCache {
    crop_value: Value,
    cropped_image: DynamicImage,
}

// New struct to hold the working image (which might be a preview)
// along with its original full-resolution dimensions.
#[derive(Clone)]
pub struct LoadedImage {
    image: DynamicImage,
    full_width: u32,
    full_height: u32,
}

pub struct AppState {
    // AppState now holds the LoadedImage struct.
    original_image: Mutex<Option<LoadedImage>>,
    raw_file_bytes: Mutex<Option<Vec<u8>>>,
    gpu_context: Mutex<Option<GpuContext>>,
    preview_cache: Mutex<Option<PreviewCache>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Preset {
    id: String,
    name: String,
    adjustments: Value,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
struct AppSettings {
    last_root_path: Option<String>,
}

#[derive(serde::Serialize)]
struct LoadImageResult {
    original_base64: String,
    width: u32,
    height: u32,
    metadata: ImageMetadata,
    exif: HashMap<String, String>,
    is_raw: bool,
}

fn is_raw_file(path: &str) -> bool {
    let lower_path = path.to_lowercase();
    matches!(
        lower_path.split('.').last(),
        Some("arw") | Some("cr2") | Some("cr3") | Some("nef") | Some("dng") |
        Some("raf") | Some("orf") | Some("pef") | Some("rw2")
    )
}

fn encode_to_base64(image: &DynamicImage, quality: u8) -> Result<String, String> {
    let mut buf = Cursor::new(Vec::new());
    image.write_to(&mut buf, image::ImageOutputFormat::Jpeg(quality))
        .map_err(|e| e.to_string())?;
    let base64_str = general_purpose::STANDARD.encode(buf.get_ref());
    Ok(format!("data:image/jpeg;base64,{}", base64_str))
}

fn read_exif_data(file_bytes: &[u8]) -> HashMap<String, String> {
    let mut exif_data = HashMap::new();
    let exif_reader = exif::Reader::new();
    if let Ok(exif) = exif_reader.read_from_container(&mut Cursor::new(file_bytes)) {
        for field in exif.fields() {
            exif_data.insert(
                field.tag.to_string(),
                field.display_value().with_unit(&exif).to_string(),
            );
        }
    }
    exif_data
}

#[tauri::command]
async fn load_image(path: String, state: tauri::State<'_, AppState>) -> Result<LoadImageResult, String> {
    let file_bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let is_raw = is_raw_file(&path);

    let (img, full_res_dims) = if is_raw {
        *state.raw_file_bytes.lock().unwrap() = Some(file_bytes.clone());
        
        let raw_info = rawloader::decode(&mut Cursor::new(&file_bytes))
            .map_err(|e| e.to_string())?;
        
        let crops = raw_info.crops;
        let full_width = raw_info.width as u32 - crops[3] as u32 - crops[1] as u32;
        let full_height = raw_info.height as u32 - crops[0] as u32 - crops[2] as u32;
        
        let preview_img = raw_processing::develop_raw_fast_preview(&file_bytes)
            .map_err(|e| e.to_string())?;
        (preview_img, (full_width, full_height))
    } else {
        *state.raw_file_bytes.lock().unwrap() = None;
        let loaded_img = image::load_from_memory(&file_bytes).map_err(|e| e.to_string())?;
        let dims = loaded_img.dimensions();
        (loaded_img, dims)
    };

    let (orig_width, orig_height) = full_res_dims;

    let exif_data = read_exif_data(&file_bytes);

    const DISPLAY_PREVIEW_DIM: u32 = 2160;
    let display_preview = img.thumbnail(DISPLAY_PREVIEW_DIM, DISPLAY_PREVIEW_DIM);
    let original_base64 = encode_to_base64(&display_preview, 85)?;

    *state.original_image.lock().unwrap() = Some(LoadedImage {
        image: img,
        full_width: orig_width,
        full_height: orig_height,
    });

    *state.preview_cache.lock().unwrap() = None;

    let sidecar_path = get_sidecar_path(&path);
    let metadata = if sidecar_path.exists() {
        let file_content = std::fs::read_to_string(sidecar_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&file_content).unwrap_or_default()
    } else {
        ImageMetadata::default()
    };

    Ok(LoadImageResult {
        original_base64,
        width: orig_width,
        height: orig_height,
        metadata,
        exif: exif_data,
        is_raw,
    })
}

fn process_image_for_preview(
    context: &GpuContext,
    image: &DynamicImage,
    all_adjustments: AllAdjustments,
    quality: u8,
) -> Result<String, String> {
    let processed_pixels = run_gpu_processing(context, image, all_adjustments)?;
    let (width, height) = image.dimensions();
    let img_buf = ImageBuffer::<Rgba<u8>, Vec<u8>>::from_raw(width, height, processed_pixels)
        .ok_or("Failed to create image buffer from GPU data")?;

    encode_to_base64(&DynamicImage::ImageRgba8(img_buf), quality)
}


#[tauri::command]
fn apply_adjustments(
    js_adjustments: serde_json::Value,
    state: tauri::State<AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let context = get_or_init_gpu_context(&state)?;
    let adjustments_clone = js_adjustments.clone();

    let mut cache_lock = state.preview_cache.lock().unwrap();
    let current_crop_value = &js_adjustments["crop"];

    let cache_is_valid = match &*cache_lock {
        Some(cache) => &cache.crop_value == current_crop_value,
        None => false,
    };

    let loaded_image = state.original_image.lock().unwrap().clone().ok_or("No original image loaded")?;
    let original_image = loaded_image.image;
    let (full_w, full_h) = (loaded_image.full_width, loaded_image.full_height);

    let cropped_image_base = if cache_is_valid {
        cache_lock.as_ref().unwrap().cropped_image.clone()
    } else {
        let (preview_w, preview_h) = original_image.dimensions();
        let crop_scale_x = preview_w as f32 / full_w as f32;
        let crop_scale_y = preview_h as f32 / full_h as f32;

        let original_crop = serde_json::from_value::<image_processing::Crop>(current_crop_value.clone())
            .unwrap_or(image_processing::Crop {
                x: 0.0, y: 0.0, width: full_w as f64, height: full_h as f64,
            });

        let preview_crop_x = (original_crop.x as f32 * crop_scale_x).round() as u32;
        let preview_crop_y = (original_crop.y as f32 * crop_scale_y).round() as u32;
        let preview_crop_w = (original_crop.width as f32 * crop_scale_x).round() as u32;
        let preview_crop_h = (original_crop.height as f32 * crop_scale_y).round() as u32;

        let new_cropped_image = original_image.crop_imm(
            preview_crop_x, preview_crop_y, preview_crop_w, preview_crop_h
        );

        *cache_lock = Some(PreviewCache {
            crop_value: current_crop_value.clone(),
            cropped_image: new_cropped_image.clone(),
        });
        new_cropped_image
    };

    thread::spawn(move || {
        let (cropped_w, _cropped_h) = cropped_image_base.dimensions();

        const QUICK_PREVIEW_DIM: u32 = 1080;
        const FINAL_PREVIEW_DIM: u32 = 2160;

        let final_target_dim = cropped_w.min(FINAL_PREVIEW_DIM);
        let final_preview_base = cropped_image_base.thumbnail(final_target_dim, final_target_dim);
        
        let original_crop_width = js_adjustments["crop"]["width"].as_f64().unwrap_or(full_w as f64) as u32;

        let final_scale = if original_crop_width > 0 {
            (final_preview_base.width() as f32 / original_crop_width as f32).min(1.0)
        } else {
            1.0
        };
        
        let final_adjustments = get_all_adjustments_from_json(&adjustments_clone, final_scale);

        if let Ok(final_processed_image) = process_and_get_dynamic_image(&context, &final_preview_base, final_adjustments) {
            let quick_processed_image = final_processed_image.thumbnail(QUICK_PREVIEW_DIM, QUICK_PREVIEW_DIM);
            
            if let Ok(histogram_data) = image_processing::calculate_histogram_from_image(&quick_processed_image) {
                let _ = app_handle.emit("histogram-update", histogram_data);
            }

            if let Ok(base64_str) = encode_to_base64(&quick_processed_image, 75) {
                let _ = app_handle.emit("preview-update-quick", base64_str);
            }

            if let Ok(base64_str) = encode_to_base64(&final_processed_image, 88) {
                let _ = app_handle.emit("preview-update-final", base64_str);
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn generate_uncropped_preview(
    js_adjustments: serde_json::Value,
    state: tauri::State<AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let context = get_or_init_gpu_context(&state)?;
    let loaded_image = state.original_image.lock().unwrap().clone().ok_or("No original image loaded")?;
    let original_image = loaded_image.image;
    let (full_w, _full_h) = (loaded_image.full_width, loaded_image.full_height);

    thread::spawn(move || {
        const UNCROPPED_PREVIEW_DIM: u32 = 2160;
        
        let uncropped_target_dim = original_image.width().min(UNCROPPED_PREVIEW_DIM);
        let uncropped_preview_base = original_image.thumbnail(uncropped_target_dim, uncropped_target_dim);

        let uncropped_scale = if full_w > 0 { (uncropped_preview_base.width() as f32 / full_w as f32).min(1.0) } else { 1.0 };
        let uncropped_adjustments = get_all_adjustments_from_json(&js_adjustments, uncropped_scale);

        if let Ok(base64_str) = process_image_for_preview(&context, &uncropped_preview_base, uncropped_adjustments, 85) {
            let _ = app_handle.emit("preview-update-uncropped", base64_str);
        }
    });

    Ok(())
}

#[tauri::command]
fn generate_fullscreen_preview(
    js_adjustments: serde_json::Value,
    state: tauri::State<AppState>,
) -> Result<String, String> {
    let context = get_or_init_gpu_context(&state)?;

    let base_image = {
        let raw_bytes_lock = state.raw_file_bytes.lock().unwrap();
        if let Some(bytes) = &*raw_bytes_lock {
            raw_processing::develop_raw_image(bytes, raw_processing::DemosaicAlgorithm::Linear)?
        } else {
            let original_image_lock = state.original_image.lock().unwrap();
            original_image_lock.as_ref().ok_or("No original image loaded")?.image.clone()
        }
    };

    let cropped_image = image_processing::apply_crop(base_image, &js_adjustments["crop"]);
    let all_adjustments = get_all_adjustments_from_json(&js_adjustments, 1.0);

    let processed_pixels = run_gpu_processing(&context, &cropped_image, all_adjustments)?;
    let (width, height) = cropped_image.dimensions();
    let final_image_buffer = ImageBuffer::<Rgba<u8>, Vec<u8>>::from_raw(width, height, processed_pixels)
        .ok_or("Failed to create final image buffer for fullscreen preview")?;
    
    encode_to_base64(&DynamicImage::ImageRgba8(final_image_buffer), 95)
}

#[tauri::command]
fn export_image(
    path: String,
    js_adjustments: Value,
    demosaic_quality: Option<DemosaicAlgorithm>,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let context = get_or_init_gpu_context(&state)?;

    let base_image = {
        let raw_bytes_lock = state.raw_file_bytes.lock().unwrap();
        if let (Some(bytes), Some(quality)) = (&*raw_bytes_lock, demosaic_quality) {
            raw_processing::develop_raw_image(bytes, quality)?
        } else {
            let original_image_lock = state.original_image.lock().unwrap();
            original_image_lock.as_ref().ok_or("No original image loaded")?.image.clone()
        }
    };

    let cropped_image = image_processing::apply_crop(base_image, &js_adjustments["crop"]);
    let all_adjustments = get_all_adjustments_from_json(&js_adjustments, 1.0);

    let processed_pixels = run_gpu_processing(&context, &cropped_image, all_adjustments)?;
    let (width, height) = cropped_image.dimensions();
    let final_image = ImageBuffer::<Rgba<u8>, Vec<u8>>::from_raw(width, height, processed_pixels)
        .ok_or("Failed to create final image buffer")?;

    final_image.save(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn save_metadata_and_update_thumbnail(
    path: String,
    adjustments: Value,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let sidecar_path = get_sidecar_path(&path);

    let metadata = ImageMetadata {
        version: 1,
        rating: adjustments["rating"].as_u64().unwrap_or(0) as u8,
        adjustments,
    };

    let json_string = serde_json::to_string_pretty(&metadata).map_err(|e| e.to_string())?;
    std::fs::write(sidecar_path, json_string).map_err(|e| e.to_string())?;

    thread::spawn(move || {
        let _ = app_handle.emit("thumbnail-progress", serde_json::json!({ "completed": 0, "total": 1 }));
        let _ = file_management::generate_thumbnails_progressive(vec![path], app_handle);
    });

    Ok(())
}

#[tauri::command]
fn apply_adjustments_to_paths(
    paths: Vec<String>,
    adjustments: Value,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    use rayon::prelude::*;

    paths.par_iter().for_each(|path| {
        let sidecar_path = get_sidecar_path(path);

        let existing_metadata: ImageMetadata = if sidecar_path.exists() {
            fs::read_to_string(&sidecar_path)
                .ok()
                .and_then(|content| serde_json::from_str(&content).ok())
                .unwrap_or_default()
        } else {
            ImageMetadata::default()
        };

        let mut new_adjustments = existing_metadata.adjustments;
        if new_adjustments.is_null() {
            new_adjustments = serde_json::json!({});
        }
        
        if let (Some(new_map), Some(pasted_map)) = (new_adjustments.as_object_mut(), adjustments.as_object()) {
            for (k, v) in pasted_map {
                new_map.insert(k.clone(), v.clone());
            }
        }

        let metadata = ImageMetadata {
            version: 1,
            rating: new_adjustments["rating"].as_u64().unwrap_or(0) as u8,
            adjustments: new_adjustments,
        };

        if let Ok(json_string) = serde_json::to_string_pretty(&metadata) {
            let _ = std::fs::write(sidecar_path, json_string);
        }
    });

    thread::spawn(move || {
        let _ = file_management::generate_thumbnails_progressive(paths, app_handle);
    });

    Ok(())
}

#[tauri::command]
fn reset_adjustments_for_paths(paths: Vec<String>, app_handle: tauri::AppHandle) -> Result<(), String> {
    use rayon::prelude::*;

    paths.par_iter().for_each(|path| {
        let sidecar_path = get_sidecar_path(path);

        let existing_metadata: ImageMetadata = if sidecar_path.exists() {
            fs::read_to_string(&sidecar_path)
                .ok()
                .and_then(|content| serde_json::from_str(&content).ok())
                .unwrap_or_default()
        } else {
            ImageMetadata::default()
        };

        let new_adjustments = serde_json::json!({
            "rating": existing_metadata.rating
        });
        
        let metadata = ImageMetadata {
            version: 1,
            rating: existing_metadata.rating,
            adjustments: new_adjustments,
        };

        if let Ok(json_string) = serde_json::to_string_pretty(&metadata) {
            let _ = std::fs::write(sidecar_path, json_string);
        }
    });

    thread::spawn(move || {
        let _ = file_management::generate_thumbnails_progressive(paths, app_handle);
    });

    Ok(())
}

#[tauri::command]
fn load_metadata(path: String) -> Result<ImageMetadata, String> {
    let sidecar_path = get_sidecar_path(&path);
    if sidecar_path.exists() {
        let file_content = std::fs::read_to_string(sidecar_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&file_content).map_err(|e| e.to_string())
    } else {
        Ok(ImageMetadata::default())
    }
}

fn get_presets_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let presets_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("presets");

    if !presets_dir.exists() {
        fs::create_dir_all(&presets_dir).map_err(|e| e.to_string())?;
    }

    Ok(presets_dir.join("presets.json"))
}

#[tauri::command]
fn load_presets(app_handle: tauri::AppHandle) -> Result<Vec<Preset>, String> {
    let path = get_presets_path(&app_handle)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_presets(presets: Vec<Preset>, app_handle: tauri::AppHandle) -> Result<(), String> {
    let path = get_presets_path(&app_handle)?;
    let json_string = serde_json::to_string_pretty(&presets).map_err(|e| e.to_string())?;
    fs::write(path, json_string).map_err(|e| e.to_string())
}

fn get_settings_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let settings_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    if !settings_dir.exists() {
        fs::create_dir_all(&settings_dir).map_err(|e| e.to_string())?;
    }

    Ok(settings_dir.join("settings.json"))
}

#[tauri::command]
fn load_settings(app_handle: tauri::AppHandle) -> Result<AppSettings, String> {
    let path = get_settings_path(&app_handle)?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_settings(settings: AppSettings, app_handle: tauri::AppHandle) -> Result<(), String> {
    let path = get_settings_path(&app_handle)?;
    let json_string = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(path, json_string).map_err(|e| e.to_string())
}

#[tauri::command]
fn generate_preset_preview(
    js_adjustments: serde_json::Value,
    state: tauri::State<AppState>,
) -> Result<String, String> {
    let context = get_or_init_gpu_context(&state)?;

    let loaded_image = state.original_image.lock().unwrap().clone()
        .ok_or("No original image loaded for preset preview")?;
    let original_image = loaded_image.image;
    let (full_w, _full_h) = (loaded_image.full_width, loaded_image.full_height);
    
    let cropped_image = image_processing::apply_crop(original_image, &js_adjustments["crop"]);
    let (cropped_w, _cropped_h) = cropped_image.dimensions();

    const PRESET_PREVIEW_DIM: u32 = 200;
    let preview_base = cropped_image.thumbnail(PRESET_PREVIEW_DIM, PRESET_PREVIEW_DIM);

    let original_crop_width = js_adjustments["crop"]["width"].as_f64().unwrap_or(full_w as f64) as u32;

    let scale = if original_crop_width > 0 {
        (preview_base.width() as f32 / original_crop_width as f32).min(1.0)
    } else {
        1.0
    };

    let all_adjustments = get_all_adjustments_from_json(&js_adjustments, scale);
    
    let processed_image = process_and_get_dynamic_image(&context, &preview_base, all_adjustments)?;
    
    encode_to_base64(&processed_image, 50)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            #[cfg(target_os = "windows")]
            apply_acrylic(&window, Some((26, 29, 27, 60)))
                .expect("Unsupported platform! 'apply_acrylic' is only supported on Windows");

            Ok(())
        })
        .manage(AppState {
            original_image: Mutex::new(None),
            raw_file_bytes: Mutex::new(None),
            gpu_context: Mutex::new(None),
            preview_cache: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            load_image,
            apply_adjustments,
            export_image,
            generate_fullscreen_preview,
            save_metadata_and_update_thumbnail,
            apply_adjustments_to_paths,
            load_metadata,
            image_processing::generate_histogram,
            file_management::list_images_in_dir,
            file_management::get_folder_tree,
            file_management::generate_thumbnails,
            file_management::generate_thumbnails_progressive,
            load_presets,
            save_presets,
            generate_preset_preview,
            generate_uncropped_preview,
            load_settings,
            save_settings,
            reset_adjustments_for_paths
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}