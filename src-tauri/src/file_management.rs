// src/file_management.rs

use std::collections::HashMap;
use std::fs;
use std::io::Cursor;
use std::path::Path;
use std::thread;

use base64::{Engine as _, engine::general_purpose};
use image::codecs::jpeg::JpegEncoder;
use rayon::prelude::*;
use serde::Serialize;
use tauri::{Emitter, Manager};

const THUMBNAIL_WIDTH: u32 = 256;

// --- Directory and File Listing ---

#[tauri::command]
pub fn list_images_in_dir(path: String) -> Result<Vec<String>, String> {
    let entries = fs::read_dir(path)
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_file())
        .filter(|path| {
            path.extension()
                .and_then(|s| s.to_str())
                .map_or(false, |ext| ["jpg", "jpeg", "png", "gif", "bmp"].contains(&ext.to_lowercase().as_str()))
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
    for entry in entries.filter_map(Result::ok) {
        let current_path = entry.path();
        if current_path.is_dir() {
            let sub_children = scan_dir_recursive(&current_path)?;
            let has_images = list_images_in_dir(current_path.to_string_lossy().into_owned())
                .map_or(false, |images| !images.is_empty());
            if !sub_children.is_empty() || has_images {
                children.push(FolderNode {
                    name: current_path.file_name().unwrap_or_default().to_string_lossy().into_owned(),
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
    let name = root_path.file_name().unwrap_or_default().to_string_lossy().into_owned();
    let children = scan_dir_recursive(root_path).map_err(|e| e.to_string())?;
    Ok(FolderNode { name, path, children })
}

#[tauri::command]
pub fn get_folder_tree(path: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let app_handle_clone = app_handle.clone();
    thread::spawn(move || {
        match get_folder_tree_sync(path) {
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
        }
    });
    Ok(())
}

// --- Thumbnail Generation ---

#[tauri::command]
pub fn generate_thumbnails(
    paths: Vec<String>,
    app_handle: tauri::AppHandle,
) -> Result<HashMap<String, String>, String> {
    let cache_dir = app_handle.path().app_cache_dir().map_err(|e| e.to_string())?;
    let thumb_cache_dir = cache_dir.join("thumbnails");
    if !thumb_cache_dir.exists() {
        fs::create_dir_all(&thumb_cache_dir).map_err(|e| e.to_string())?;
    }

    let thumbnails: HashMap<String, String> = paths
        .par_iter()
        .filter_map(|path_str| {
            let original_path = Path::new(path_str);
            let metadata = fs::metadata(original_path).ok()?;
            let mod_time = metadata.modified().ok()?.duration_since(std::time::UNIX_EPOCH).ok()?.as_secs();
            let mut hasher = blake3::Hasher::new();
            hasher.update(path_str.as_bytes());
            let hash = hasher.finalize();
            let cache_filename = format!("{}-{}.jpg", hash.to_hex(), mod_time);
            let cache_path = thumb_cache_dir.join(cache_filename);

            if cache_path.exists() {
                if let Ok(data) = fs::read(&cache_path) {
                    let base64_str = general_purpose::STANDARD.encode(&data);
                    return Some((path_str.clone(), format!("data:image/jpeg;base64,{}", base64_str)));
                }
            }

            let img = image::open(original_path).ok()?;
            let thumbnail = img.thumbnail(THUMBNAIL_WIDTH, THUMBNAIL_WIDTH);
            let mut buf = Cursor::new(Vec::new());
            let mut encoder = JpegEncoder::new_with_quality(&mut buf, 75);
            if encoder.encode_image(&thumbnail.to_rgba8()).is_err() { return None; };
            let thumb_data = buf.into_inner();
            let _ = fs::write(&cache_path, &thumb_data);
            let base64_str = general_purpose::STANDARD.encode(&thumb_data);
            Some((path_str.clone(), format!("data:image/jpeg;base64,{}", base64_str)))
        })
        .collect();

    Ok(thumbnails)
}

#[tauri::command]
pub fn generate_thumbnails_progressive(
    paths: Vec<String>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let cache_dir = app_handle.path().app_cache_dir().map_err(|e| e.to_string())?;
    let thumb_cache_dir = cache_dir.join("thumbnails");
    if !thumb_cache_dir.exists() {
        fs::create_dir_all(&thumb_cache_dir).map_err(|e| e.to_string())?;
    }

    let app_handle_clone = app_handle.clone();
    let total_count = paths.len();
    
    thread::spawn(move || {
        let mut completed = 0;
        for path_str in paths {
            let original_path = Path::new(&path_str);
            let result = (|| -> Option<String> {
                let metadata = fs::metadata(original_path).ok()?;
                let mod_time = metadata.modified().ok()?.duration_since(std::time::UNIX_EPOCH).ok()?.as_secs();
                let mut hasher = blake3::Hasher::new();
                hasher.update(path_str.as_bytes());
                let hash = hasher.finalize();
                let cache_filename = format!("{}-{}.jpg", hash.to_hex(), mod_time);
                let cache_path = thumb_cache_dir.join(cache_filename);

                if cache_path.exists() {
                    if let Ok(data) = fs::read(&cache_path) {
                        let base64_str = general_purpose::STANDARD.encode(&data);
                        return Some(format!("data:image/jpeg;base64,{}", base64_str));
                    }
                }

                let img = image::open(original_path).ok()?;
                let thumbnail = img.thumbnail(THUMBNAIL_WIDTH, THUMBNAIL_WIDTH);
                let mut buf = Cursor::new(Vec::new());
                let mut encoder = JpegEncoder::new_with_quality(&mut buf, 75);
                encoder.encode_image(&thumbnail.to_rgba8()).ok()?;
                let thumb_data = buf.into_inner();
                let _ = fs::write(&cache_path, &thumb_data);
                let base64_str = general_purpose::STANDARD.encode(&thumb_data);
                Some(format!("data:image/jpeg;base64,{}", base64_str))
            })();
            
            if let Some(thumbnail_data) = result {
                let _ = app_handle_clone.emit("thumbnail-generated", serde_json::json!({ "path": path_str, "data": thumbnail_data }));
            }
            completed += 1;
            let _ = app_handle_clone.emit("thumbnail-progress", serde_json::json!({ "completed": completed, "total": total_count }));
        }
        let _ = app_handle_clone.emit("thumbnail-generation-complete", true);
    });

    Ok(())
}