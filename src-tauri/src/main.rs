// src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod image_processing;
mod file_management;

use std::io::Cursor;
use std::sync::Mutex;
use std::thread;

use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba, imageops::FilterType};
use tauri::{Manager, Emitter};
use base64::{Engine as _, engine::general_purpose};
use serde_json::Value;
use window_vibrancy::{apply_acrylic, apply_vibrancy, NSVisualEffectMaterial};

use crate::image_processing::{
    get_adjustments_from_json, get_or_init_gpu_context, run_gpu_processing, Adjustments, GpuContext, ImageMetadata,
};
use crate::file_management::get_sidecar_path;

pub struct AppState {
    original_image: Mutex<Option<DynamicImage>>,
    quick_preview_image: Mutex<Option<DynamicImage>>,
    final_preview_image: Mutex<Option<DynamicImage>>,
    gpu_context: Mutex<Option<GpuContext>>,
}

#[derive(serde::Serialize)]
struct LoadImageResult {
    original_base64: String,
    width: u32,
    height: u32,
    metadata: ImageMetadata,
}

fn encode_to_base64(image: &DynamicImage, quality: u8) -> Result<String, String> {
    let mut buf = Cursor::new(Vec::new());
    image.write_to(&mut buf, image::ImageOutputFormat::Jpeg(quality))
         .map_err(|e| e.to_string())?;
    let base64_str = general_purpose::STANDARD.encode(buf.get_ref());
    Ok(format!("data:image/jpeg;base64,{}", base64_str))
}

#[tauri::command]
async fn load_image(path: String, state: tauri::State<'_, AppState>) -> Result<LoadImageResult, String> {
    let img = image::open(&path).map_err(|e| e.to_string())?;
    let (orig_width, orig_height) = img.dimensions();

    const DISPLAY_PREVIEW_DIM: u32 = 1280;
    const FINAL_PREVIEW_MAX_DIM: u32 = 2160;

    let ((original_base64_result, quick_preview), final_preview) = rayon::join(
        || rayon::join(
            || {
                let preview = img.thumbnail(DISPLAY_PREVIEW_DIM, DISPLAY_PREVIEW_DIM);
                encode_to_base64(&preview, 85)
            },
            || {
                let new_width = (orig_width / 3).max(1);
                let new_height = (orig_height / 3).max(1);
                img.resize(new_width, new_height, FilterType::Triangle)
            }
        ),
        || {
            if orig_width > FINAL_PREVIEW_MAX_DIM || orig_height > FINAL_PREVIEW_MAX_DIM {
                img.thumbnail(FINAL_PREVIEW_MAX_DIM, FINAL_PREVIEW_MAX_DIM)
            } else {
                img.clone()
            }
        }
    );

    let original_base64 = original_base64_result?;

    *state.original_image.lock().unwrap() = Some(img);
    *state.quick_preview_image.lock().unwrap() = Some(quick_preview);
    *state.final_preview_image.lock().unwrap() = Some(final_preview);

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
    })
}

fn process_and_encode_image(
    context: &GpuContext,
    image: &DynamicImage,
    adjustments: Adjustments,
    quality: u8,
) -> Result<String, String> {
    let processed_pixels = run_gpu_processing(context, image, adjustments)?;
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
    let quick_preview = state.quick_preview_image.lock().unwrap().clone().ok_or("No quick preview image loaded")?;
    let final_preview = state.final_preview_image.lock().unwrap().clone().ok_or("No final preview image loaded")?;

    let adjustments = get_adjustments_from_json(&js_adjustments);

    thread::spawn(move || {
        if let Ok(base64_str) = process_and_encode_image(&context, &quick_preview, adjustments, 65) {
            app_handle.emit("preview-update-quick", base64_str).unwrap();
        }
        if let Ok(base64_str) = process_and_encode_image(&context, &final_preview, adjustments, 85) {
            app_handle.emit("preview-update-final", base64_str).unwrap();
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
    let original_image = state.original_image.lock().unwrap().clone().ok_or("No original image loaded")?;
    let adjustments = get_adjustments_from_json(&js_adjustments);

    process_and_encode_image(&context, &original_image, adjustments, 90)
}

#[tauri::command]
fn export_image(path: String, js_adjustments: serde_json::Value, state: tauri::State<AppState>) -> Result<(), String> {
    let original_image = {
        let lock = state.original_image.lock().unwrap();
        lock.clone().ok_or("No original image loaded")?
    };
    let context = get_or_init_gpu_context(&state)?;
    
    let adjustments = get_adjustments_from_json(&js_adjustments);

    let processed_pixels = run_gpu_processing(&context, &original_image, adjustments)?;
    let (width, height) = original_image.dimensions();
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
        rating: 0,
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
            quick_preview_image: Mutex::new(None),
            final_preview_image: Mutex::new(None),
            gpu_context: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            load_image,
            apply_adjustments,
            export_image,
            generate_fullscreen_preview,
            save_metadata_and_update_thumbnail,
            image_processing::generate_histogram,
            image_processing::generate_processed_histogram,
            file_management::list_images_in_dir,
            file_management::get_folder_tree,
            file_management::generate_thumbnails, 
            file_management::generate_thumbnails_progressive
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}