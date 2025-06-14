#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io::Cursor;
use std::sync::{Arc, Mutex};
use std::thread;
use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba, ImageEncoder};
use image::codecs::jpeg::JpegEncoder;
use serde::{Serialize, Deserialize};
use base64::{Engine as _, engine::general_purpose};
use bytemuck::{Pod, Zeroable};
use wgpu::util::DeviceExt;
use tauri::Emitter;

const QUICK_PREVIEW_WIDTH: u32 = 720;
const FINAL_PREVIEW_WIDTH: u32 = 1280;

#[derive(Clone)]
struct GpuContext {
    device: Arc<wgpu::Device>,
    queue: Arc<wgpu::Queue>,
}

struct AppState {
    original_image: Mutex<Option<DynamicImage>>,
    quick_preview_image: Mutex<Option<DynamicImage>>,
    final_preview_image: Mutex<Option<DynamicImage>>,
    gpu_context: Mutex<Option<GpuContext>>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, Pod, Zeroable)]
#[repr(C)]
struct Point {
    x: f32,
    y: f32,
    _pad1: f32,
    _pad2: f32,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, Pod, Zeroable)]
#[repr(C)]
struct HslColor {
    hue: f32,
    saturation: f32,
    luminance: f32,
    _pad: f32,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, Pod, Zeroable)]
#[repr(C)]
struct Adjustments {
    // Group 1 (vec4)
    exposure: f32,
    contrast: f32,
    highlights: f32,
    shadows: f32,
    // Group 2 (vec4)
    whites: f32,
    blacks: f32,
    saturation: f32,
    temperature: f32,
    // Group 3 (vec4)
    tint: f32,
    vibrance: f32,
    _pad1: f32,
    _pad2: f32,
    // HSL and Curves
    hsl: [HslColor; 8],
    curve_points: [Point; 16],
    curve_points_count: u32,
    _p1: u32,
    _p2: u32,
    _p3: u32,
}

fn parse_hsl_adjustments(js_hsl: &serde_json::Value) -> [HslColor; 8] {
    let mut hsl_array = [HslColor { hue: 0.0, saturation: 0.0, luminance: 0.0, _pad: 0.0 }; 8];
    if let Some(hsl_map) = js_hsl.as_object() {
        let color_map = [
            ("reds", 0), ("oranges", 1), ("yellows", 2), ("greens", 3),
            ("aquas", 4), ("blues", 5), ("purples", 6), ("magentas", 7),
        ];

        for (name, index) in color_map.iter() {
            if let Some(color_data) = hsl_map.get(*name) {
                hsl_array[*index] = HslColor {
                    hue: color_data["hue"].as_f64().unwrap_or(0.0) as f32 * 0.3,
                    saturation: color_data["saturation"].as_f64().unwrap_or(0.0) as f32 / 100.0,
                    luminance: color_data["luminance"].as_f64().unwrap_or(0.0) as f32 / 100.0,
                    _pad: 0.0,
                };
            }
        }
    }
    hsl_array
}

fn get_adjustments_from_json(js_adjustments: &serde_json::Value) -> Adjustments {
    let curve_points_vec: Vec<serde_json::Value> = js_adjustments["curve_points"].as_array().cloned().unwrap_or_default();
    
    // Normalize slider values from [-100, 100] to a smaller, more effective range for the shader.
    // A larger divisor means a more subtle effect.
    Adjustments {
        // Exposure is a strong effect, so we scale it to [-1.0, 1.0]
        exposure: js_adjustments["exposure"].as_f64().unwrap_or(0.0) as f32 / 100.0,
        // Other effects are more subtle. We scale them to a [-0.5, 0.5] range.
        contrast: js_adjustments["contrast"].as_f64().unwrap_or(0.0) as f32 / 200.0,
        highlights: js_adjustments["highlights"].as_f64().unwrap_or(0.0) as f32 / 200.0,
        shadows: js_adjustments["shadows"].as_f64().unwrap_or(0.0) as f32 / 200.0,
        whites: js_adjustments["whites"].as_f64().unwrap_or(0.0) as f32 / 300.0,
        blacks: js_adjustments["blacks"].as_f64().unwrap_or(0.0) as f32 / 300.0,
        
        // These were already scaled reasonably
        saturation: js_adjustments["saturation"].as_f64().unwrap_or(0.0) as f32 / 100.0,
        temperature: js_adjustments["temperature"].as_f64().unwrap_or(0.0) as f32 / 500.0,
        tint: js_adjustments["tint"].as_f64().unwrap_or(0.0) as f32 / 500.0,
        vibrance: js_adjustments["vibrance"].as_f64().unwrap_or(0.0) as f32 / 100.0,
        
        _pad1: 0.0,
        _pad2: 0.0,
        hsl: parse_hsl_adjustments(&js_adjustments.get("hsl").cloned().unwrap_or_default()),
        curve_points: convert_points_to_aligned(curve_points_vec.clone()),
        curve_points_count: curve_points_vec.len() as u32,
        _p1: 0, _p2: 0, _p3: 0,
    }
}

// ... (The rest of the file remains unchanged)
fn convert_points_to_aligned(frontend_points: Vec<serde_json::Value>) -> [Point; 16] {
    let mut aligned_points = [Point { x: 0.0, y: 0.0, _pad1: 0.0, _pad2: 0.0 }; 16];
    for (i, point) in frontend_points.iter().enumerate().take(16) {
        if let (Some(x), Some(y)) = (point["x"].as_f64(), point["y"].as_f64()) {
            aligned_points[i] = Point { x: x as f32, y: y as f32, _pad1: 0.0, _pad2: 0.0 };
        }
    }
    aligned_points
}

fn get_or_init_gpu_context(state: &tauri::State<AppState>) -> Result<GpuContext, String> {
    let mut context_lock = state.gpu_context.lock().unwrap();
    if let Some(context) = &*context_lock {
        return Ok(context.clone());
    }

    let instance = wgpu::Instance::new(wgpu::InstanceDescriptor::default());
    let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions::default()))
        .ok_or("Failed to find a wgpu adapter.")?;
    
    let (device, queue) = pollster::block_on(adapter.request_device(
        &wgpu::DeviceDescriptor {
            label: Some("Processing Device"),
            required_features: wgpu::Features::empty(),
            required_limits: wgpu::Limits::default(),
        },
        None,
    )).map_err(|e| e.to_string())?;

    let new_context = GpuContext { device: Arc::new(device), queue: Arc::new(queue) };
    *context_lock = Some(new_context.clone());
    Ok(new_context)
}

#[tauri::command]
fn load_image(path: String, state: tauri::State<AppState>) -> Result<(u32, u32), String> {
    let img = image::open(&path).map_err(|e| e.to_string())?;
    let dimensions = img.dimensions();
    let quick_preview = img.thumbnail(QUICK_PREVIEW_WIDTH, QUICK_PREVIEW_WIDTH);
    let final_preview = img.thumbnail(FINAL_PREVIEW_WIDTH, FINAL_PREVIEW_WIDTH);

    *state.original_image.lock().unwrap() = Some(img);
    *state.quick_preview_image.lock().unwrap() = Some(quick_preview);
    *state.final_preview_image.lock().unwrap() = Some(final_preview);

    Ok(dimensions)
}

fn run_gpu_processing(
    context: &GpuContext,
    image: &DynamicImage,
    adjustments: Adjustments,
) -> Result<Vec<u8>, String> {
    let device = &context.device;
    let queue = &context.queue;
    let img_rgba = image.to_rgba8();
    let (width, height) = img_rgba.dimensions();
    let texture_size = wgpu::Extent3d { width, height, depth_or_array_layers: 1 };

    let input_texture = device.create_texture_with_data(
        queue,
        &wgpu::TextureDescriptor {
            label: Some("Input Texture"), size: texture_size, mip_level_count: 1, sample_count: 1,
            dimension: wgpu::TextureDimension::D2, format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST, view_formats: &[],
        },
        wgpu::util::TextureDataOrder::MipMajor, &img_rgba,
    );

    let output_texture = device.create_texture(&wgpu::TextureDescriptor {
        label: Some("Output Texture"), size: texture_size, mip_level_count: 1, sample_count: 1,
        dimension: wgpu::TextureDimension::D2, format: wgpu::TextureFormat::Rgba8Unorm,
        usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::COPY_SRC, view_formats: &[],
    });

    let adjustments_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some("Adjustments Buffer"),
        contents: bytemuck::bytes_of(&adjustments),
        usage: wgpu::BufferUsages::UNIFORM,
    });

    let shader_module = device.create_shader_module(wgpu::ShaderModuleDescriptor {
        label: Some("Image Processing Shader"),
        source: wgpu::ShaderSource::Wgsl(include_str!("shader.wgsl").into()),
    });

    let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
        label: Some("Bind Group Layout"),
        entries: &[
            wgpu::BindGroupLayoutEntry {
                binding: 0, visibility: wgpu::ShaderStages::COMPUTE,
                ty: wgpu::BindingType::Texture {
                    sample_type: wgpu::TextureSampleType::Float { filterable: false },
                    view_dimension: wgpu::TextureViewDimension::D2, multisampled: false,
                }, count: None,
            },
            wgpu::BindGroupLayoutEntry {
                binding: 1, visibility: wgpu::ShaderStages::COMPUTE,
                ty: wgpu::BindingType::StorageTexture {
                    access: wgpu::StorageTextureAccess::WriteOnly,
                    format: wgpu::TextureFormat::Rgba8Unorm,
                    view_dimension: wgpu::TextureViewDimension::D2,
                }, count: None,
            },
            wgpu::BindGroupLayoutEntry {
                binding: 2, visibility: wgpu::ShaderStages::COMPUTE,
                ty: wgpu::BindingType::Buffer {
                    ty: wgpu::BufferBindingType::Uniform,
                    has_dynamic_offset: false, min_binding_size: None,
                }, count: None,
            },
        ],
    });

    let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
        label: Some("Bind Group"), layout: &bind_group_layout,
        entries: &[
            wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(&input_texture.create_view(&Default::default())) },
            wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::TextureView(&output_texture.create_view(&Default::default())) },
            wgpu::BindGroupEntry { binding: 2, resource: adjustments_buffer.as_entire_binding() },
        ],
    });

    let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
        label: Some("Pipeline Layout"),
        bind_group_layouts: &[&bind_group_layout],
        push_constant_ranges: &[],
    });

    let compute_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
        label: Some("Compute Pipeline"), layout: Some(&pipeline_layout),
        module: &shader_module, entry_point: "main",
    });

    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: None });
    {
        let mut compute_pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor { label: None, timestamp_writes: None });
        compute_pass.set_pipeline(&compute_pipeline);
        compute_pass.set_bind_group(0, &bind_group, &[]);
        compute_pass.dispatch_workgroups((width + 7) / 8, (height + 7) / 8, 1);
    }

    let unpadded_bytes_per_row = 4 * width;
    let align = wgpu::COPY_BYTES_PER_ROW_ALIGNMENT;
    let padded_bytes_per_row = (unpadded_bytes_per_row + align - 1) & !(align - 1);
    let output_buffer_size = (padded_bytes_per_row * height) as u64;

    let output_buffer = device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("Output Buffer"), size: output_buffer_size,
        usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
        mapped_at_creation: false,
    });

    encoder.copy_texture_to_buffer(
        wgpu::ImageCopyTexture { texture: &output_texture, mip_level: 0, origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All },
        wgpu::ImageCopyBuffer {
            buffer: &output_buffer,
            layout: wgpu::ImageDataLayout { offset: 0, bytes_per_row: Some(padded_bytes_per_row), rows_per_image: Some(height) },
        },
        texture_size,
    );

    queue.submit(Some(encoder.finish()));
    let buffer_slice = output_buffer.slice(..);
    let (tx, rx) = std::sync::mpsc::channel();
    buffer_slice.map_async(wgpu::MapMode::Read, move |result| { tx.send(result).unwrap(); });
    device.poll(wgpu::Maintain::Wait);
    rx.recv().unwrap().map_err(|e| e.to_string())?;

    let padded_data = buffer_slice.get_mapped_range().to_vec();
    output_buffer.unmap();

    let mut unpadded_data = Vec::with_capacity((unpadded_bytes_per_row * height) as usize);
    for chunk in padded_data.chunks(padded_bytes_per_row as usize) {
        unpadded_data.extend_from_slice(&chunk[..unpadded_bytes_per_row as usize]);
    }
    Ok(unpadded_data)
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
    let mut buf = Cursor::new(Vec::new());
    let mut encoder = JpegEncoder::new_with_quality(&mut buf, quality);
    encoder.encode_image(&img_buf).map_err(|e| e.to_string())?;
    let base64_str = general_purpose::STANDARD.encode(buf.get_ref());
    Ok(format!("data:image/jpeg;base64,{}", base64_str))
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
        if let Ok(base64_str) = process_and_encode_image(&context, &quick_preview, adjustments, 60) {
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

#[tauri::command]
fn list_images_in_dir(path: String) -> Result<Vec<String>, String> {
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
            list_images_in_dir,
            load_image,
            apply_adjustments,
            export_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}