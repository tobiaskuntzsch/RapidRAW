// src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod image_processing;
mod file_management;

use std::io::Cursor;
use std::sync::Mutex;
use std::thread;

use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba};
use tauri::Emitter;
use base64::{Engine as _, engine::general_purpose};

use crate::image_processing::{
    get_adjustments_from_json, get_or_init_gpu_context, run_gpu_processing, Adjustments, GpuContext,
};

pub struct AppState {
    original_image: Mutex<Option<DynamicImage>>,
    quick_preview_image: Mutex<Option<DynamicImage>>,
    final_preview_image: Mutex<Option<DynamicImage>>,
    gpu_context: Mutex<Option<GpuContext>>,
}

// NEW: A struct to define the return type for load_image
#[derive(serde::Serialize)]
struct LoadImageResult {
    original_base64: String,
    width: u32,
    height: u32,
}

// NEW: Reusable helper function to encode a DynamicImage to a base64 JPEG string
fn encode_to_base64(image: &DynamicImage, quality: u8) -> Result<String, String> {
    let mut buf = Cursor::new(Vec::new());
    image.write_to(&mut buf, image::ImageOutputFormat::Jpeg(quality))
         .map_err(|e| e.to_string())?;
    let base64_str = general_purpose::STANDARD.encode(buf.get_ref());
    Ok(format!("data:image/jpeg;base64,{}", base64_str))
}

#[tauri::command]
fn load_image(path: String, state: tauri::State<AppState>) -> Result<LoadImageResult, String> {
    let img = image::open(&path).map_err(|e| e.to_string())?;
    let (orig_width, orig_height) = img.dimensions();

    // Generate the base64 for the original image to send to the frontend
    let original_base64 = encode_to_base64(&img, 90)?;

    let mut quick_width = orig_width / 3;
    let mut quick_height = orig_height / 3;

    quick_width = quick_width.clamp(480, 1080);
    quick_height = quick_height.clamp(480, 1080);

    let quick_preview = img.resize(quick_width, quick_height, image::imageops::FilterType::Lanczos3);
    let final_preview = img.clone();

    *state.original_image.lock().unwrap() = Some(img);
    *state.quick_preview_image.lock().unwrap() = Some(quick_preview);
    *state.final_preview_image.lock().unwrap() = Some(final_preview);

    Ok(LoadImageResult {
        original_base64,
        width: orig_width,
        height: orig_height,
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
    
    // Use our new helper function here as well for consistency
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init()) 
        .plugin(tauri_plugin_dialog::init())
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