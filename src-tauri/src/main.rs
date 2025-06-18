#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod image_processing;
mod file_management;

use std::io::Cursor;
use std::sync::Mutex;
use std::thread;
use std::fs;

use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba};
use tauri::{Manager, Emitter};
use base64::{Engine as _, engine::general_purpose};
use serde_json::Value;
use window_vibrancy::{apply_acrylic, apply_vibrancy, NSVisualEffectMaterial};
use serde::{Serialize, Deserialize};

use crate::image_processing::{
    get_all_adjustments_from_json, get_or_init_gpu_context, run_gpu_processing, GpuContext,
    ImageMetadata, apply_crop, AllAdjustments, process_and_get_dynamic_image,
};
use crate::file_management::get_sidecar_path;

#[derive(Clone)]
pub struct PreviewCache {
    crop_value: Value,
    cropped_image: DynamicImage,
}

pub struct AppState {
    original_image: Mutex<Option<DynamicImage>>,
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
    let display_preview = img.thumbnail(DISPLAY_PREVIEW_DIM, DISPLAY_PREVIEW_DIM);
    let original_base64 = encode_to_base64(&display_preview, 85)?;

    *state.original_image.lock().unwrap() = Some(img);
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

    let original_image = state.original_image.lock().unwrap().clone().ok_or("No original image loaded")?;

    let cropped_image_base = if cache_is_valid {
        cache_lock.as_ref().unwrap().cropped_image.clone()
    } else {
        let new_cropped_image = apply_crop(original_image.clone(), current_crop_value);

        *cache_lock = Some(PreviewCache {
            crop_value: current_crop_value.clone(),
            cropped_image: new_cropped_image.clone(),
        });
        new_cropped_image
    };

    thread::spawn(move || {
        let (cropped_w, _cropped_h) = cropped_image_base.dimensions();

        const QUICK_PREVIEW_DIM: u32 = 1280;
        const FINAL_PREVIEW_DIM: u32 = 1920;

        let final_target_dim = cropped_w.min(FINAL_PREVIEW_DIM);
        let final_preview_base = cropped_image_base.thumbnail(final_target_dim, final_target_dim);
        
        let final_scale = if cropped_w > 0 { (final_preview_base.width() as f32 / cropped_w as f32).min(1.0) } else { 1.0 };
        let final_adjustments = get_all_adjustments_from_json(&adjustments_clone, final_scale);

        if let Ok(final_processed_image) = process_and_get_dynamic_image(&context, &final_preview_base, final_adjustments) {
            if let Ok(base64_str) = encode_to_base64(&final_processed_image, 85) {
                let _ = app_handle.emit("preview-update-final", base64_str);
            }

            let quick_processed_image = final_processed_image.thumbnail(QUICK_PREVIEW_DIM, QUICK_PREVIEW_DIM);
            
            if let Ok(histogram_data) = image_processing::calculate_histogram_from_image(&quick_processed_image) {
                let _ = app_handle.emit("histogram-update", histogram_data);
            }

            if let Ok(base64_str) = encode_to_base64(&quick_processed_image, 80) {
                let _ = app_handle.emit("preview-update-quick", base64_str);
            }
        }

        const UNCROPPED_PREVIEW_DIM: u32 = 1920;
        let (orig_w, _orig_h) = original_image.dimensions();
        
        let uncropped_target_dim = orig_w.min(UNCROPPED_PREVIEW_DIM);
        let uncropped_preview_base = original_image.thumbnail(uncropped_target_dim, uncropped_target_dim);

        let uncropped_scale = if orig_w > 0 { (uncropped_preview_base.width() as f32 / orig_w as f32).min(1.0) } else { 1.0 };
        let uncropped_adjustments = get_all_adjustments_from_json(&adjustments_clone, uncropped_scale);

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
    let original_image = state.original_image.lock().unwrap().clone().ok_or("No original image loaded")?;

    let cropped_image = apply_crop(original_image, &js_adjustments["crop"]);
    let all_adjustments = get_all_adjustments_from_json(&js_adjustments, 1.0);

    let processed_pixels = run_gpu_processing(&context, &cropped_image, all_adjustments)?;
    let (width, height) = cropped_image.dimensions();
    let final_image_buffer = ImageBuffer::<Rgba<u8>, Vec<u8>>::from_raw(width, height, processed_pixels)
        .ok_or("Failed to create final image buffer for fullscreen preview")?;
    
    encode_to_base64(&DynamicImage::ImageRgba8(final_image_buffer), 95)
}

#[tauri::command]
fn export_image(path: String, js_adjustments: serde_json::Value, state: tauri::State<AppState>) -> Result<(), String> {
    let original_image = {
        let lock = state.original_image.lock().unwrap();
        lock.clone().ok_or("No original image loaded")?
    };
    let context = get_or_init_gpu_context(&state)?;

    let cropped_image = apply_crop(original_image, &js_adjustments["crop"]);
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

    let original_image = state.original_image.lock().unwrap().clone()
        .ok_or("No original image loaded for preset preview")?;
    
    let cropped_image = apply_crop(original_image, &js_adjustments["crop"]);
    let (cropped_w, _cropped_h) = cropped_image.dimensions();

    const PRESET_PREVIEW_DIM: u32 = 200;
    let preview_base = cropped_image.thumbnail(PRESET_PREVIEW_DIM, PRESET_PREVIEW_DIM);

    let scale = if cropped_w > 0 {
        (preview_base.width() as f32 / cropped_w as f32).min(1.0)
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
            gpu_context: Mutex::new(None),
            preview_cache: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            load_image,
            apply_adjustments,
            export_image,
            generate_fullscreen_preview,
            save_metadata_and_update_thumbnail,
            image_processing::generate_histogram,
            file_management::list_images_in_dir,
            file_management::get_folder_tree,
            file_management::generate_thumbnails,
            file_management::generate_thumbnails_progressive,
            load_presets,
            save_presets,
            generate_preset_preview,
            load_settings,
            save_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}