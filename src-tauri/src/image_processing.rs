use std::sync::Arc;
use bytemuck::{Pod, Zeroable};
use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use wgpu::util::{DeviceExt, TextureDataOrder};

use crate::{AppState};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ImageMetadata {
    pub version: u32,
    pub rating: u8,
    pub adjustments: Value,
}

impl Default for ImageMetadata {
    fn default() -> Self {
        ImageMetadata {
            version: 1,
            rating: 0,
            adjustments: Value::Null,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy)]
pub struct Crop {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

pub fn apply_crop(mut image: DynamicImage, crop_value: &Value) -> DynamicImage {
    if crop_value.is_null() {
        return image;
    }
    if let Ok(crop) = serde_json::from_value::<Crop>(crop_value.clone()) {
        let x = crop.x.round() as u32;
        let y = crop.y.round() as u32;
        let width = crop.width.round() as u32;
        let height = crop.height.round() as u32;

        if width > 0 && height > 0 {
            let (img_w, img_h) = image.dimensions();
            if x < img_w && y < img_h {
                let new_width = (img_w - x).min(width);
                let new_height = (img_h - y).min(height);
                if new_width > 0 && new_height > 0 {
                    image = image.crop_imm(x, y, new_width, new_height);
                }
            }
        }
    }
    image
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, Pod, Zeroable, Default)]
#[repr(C)]
pub struct Point {
    x: f32,
    y: f32,
    _pad1: f32,
    _pad2: f32,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, Pod, Zeroable, Default)]
#[repr(C)]
pub struct HslColor {
    hue: f32,
    saturation: f32,
    luminance: f32,
    _pad: f32,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, Pod, Zeroable, Default)]
#[repr(C)]
pub struct GlobalAdjustments {
    pub exposure: f32,
    pub contrast: f32,
    pub highlights: f32,
    pub shadows: f32,
    pub whites: f32,
    pub blacks: f32,
    pub saturation: f32,
    pub temperature: f32,
    pub tint: f32,
    pub vibrance: f32,
    _pad1: f32,
    _pad2: f32,
    pub hsl: [HslColor; 8],
    pub luma_curve: [Point; 16],
    pub red_curve: [Point; 16],
    pub green_curve: [Point; 16],
    pub blue_curve: [Point; 16],
    pub luma_curve_count: u32,
    pub red_curve_count: u32,
    pub green_curve_count: u32,
    pub blue_curve_count: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, Pod, Zeroable, Default)]
#[repr(C)]
pub struct Mask {
    mask_type: u32,
    invert: u32,
    feather: f32,
    rotation: f32,
    center_x: f32,
    center_y: f32,
    radius_x: f32,
    radius_y: f32,
    start_x: f32,
    start_y: f32,
    end_x: f32,
    end_y: f32,
    exposure: f32,
    contrast: f32,
    highlights: f32,
    shadows: f32,
    whites: f32,
    blacks: f32,
    saturation: f32,
    temperature: f32,
    tint: f32,
    vibrance: f32,
    _pad1: f32,
    _pad2: f32,
}

#[derive(Debug, Clone, Copy, Pod, Zeroable, Default)]
#[repr(C)]
pub struct AllAdjustments {
    pub global: GlobalAdjustments,
    pub masks: [Mask; 16],
    pub mask_count: u32,
    pub crop_x: u32,
    pub crop_y: u32,
    pub preview_scale: f32,
    pub tile_offset_x: u32,
    pub tile_offset_y: u32,
    _pad1: u32,
    _pad2: u32,
}

fn parse_hsl_adjustments(js_hsl: &serde_json::Value) -> [HslColor; 8] {
    let mut hsl_array = [HslColor::default(); 8];
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

fn convert_points_to_aligned(frontend_points: Vec<serde_json::Value>) -> [Point; 16] {
    let mut aligned_points = [Point::default(); 16];
    for (i, point) in frontend_points.iter().enumerate().take(16) {
        if let (Some(x), Some(y)) = (point["x"].as_f64(), point["y"].as_f64()) {
            aligned_points[i] = Point { x: x as f32, y: y as f32, _pad1: 0.0, _pad2: 0.0 };
        }
    }
    aligned_points
}

fn get_global_adjustments_from_json(js_adjustments: &serde_json::Value) -> GlobalAdjustments {
    if js_adjustments.is_null() {
        return GlobalAdjustments::default();
    }
    let curves_obj = js_adjustments.get("curves").cloned().unwrap_or_default();
    let luma_points: Vec<serde_json::Value> = curves_obj["luma"].as_array().cloned().unwrap_or_default();
    let red_points: Vec<serde_json::Value> = curves_obj["red"].as_array().cloned().unwrap_or_default();
    let green_points: Vec<serde_json::Value> = curves_obj["green"].as_array().cloned().unwrap_or_default();
    let blue_points: Vec<serde_json::Value> = curves_obj["blue"].as_array().cloned().unwrap_or_default();

    GlobalAdjustments {
        exposure: js_adjustments["exposure"].as_f64().unwrap_or(0.0) as f32 / 100.0,
        contrast: js_adjustments["contrast"].as_f64().unwrap_or(0.0) as f32 / 200.0,
        highlights: js_adjustments["highlights"].as_f64().unwrap_or(0.0) as f32 / 200.0,
        shadows: js_adjustments["shadows"].as_f64().unwrap_or(0.0) as f32 / 200.0,
        whites: js_adjustments["whites"].as_f64().unwrap_or(0.0) as f32 / 300.0,
        blacks: js_adjustments["blacks"].as_f64().unwrap_or(0.0) as f32 / 300.0,
        saturation: js_adjustments["saturation"].as_f64().unwrap_or(0.0) as f32 / 200.0,
        temperature: js_adjustments["temperature"].as_f64().unwrap_or(0.0) as f32 / 250.0,
        tint: js_adjustments["tint"].as_f64().unwrap_or(0.0) as f32 / 250.0,
        vibrance: js_adjustments["vibrance"].as_f64().unwrap_or(0.0) as f32 / 200.0,
        _pad1: 0.0, _pad2: 0.0,
        hsl: parse_hsl_adjustments(&js_adjustments.get("hsl").cloned().unwrap_or_default()),
        luma_curve: convert_points_to_aligned(luma_points.clone()),
        red_curve: convert_points_to_aligned(red_points.clone()),
        green_curve: convert_points_to_aligned(green_points.clone()),
        blue_curve: convert_points_to_aligned(blue_points.clone()),
        luma_curve_count: luma_points.len() as u32,
        red_curve_count: red_points.len() as u32,
        green_curve_count: green_points.len() as u32,
        blue_curve_count: blue_points.len() as u32,
    }
}

pub fn get_all_adjustments_from_json(js_adjustments: &serde_json::Value, preview_scale: f32) -> AllAdjustments {
    let global = get_global_adjustments_from_json(js_adjustments);
    let mut masks = [Mask::default(); 16];
    let mut mask_count = 0;

    let crop_data: Option<Crop> = js_adjustments.get("crop").and_then(|c| serde_json::from_value(c.clone()).ok());
    let (crop_x, crop_y) = crop_data.map_or((0.0, 0.0), |c| (c.x, c.y));


    if let Some(js_masks) = js_adjustments.get("masks").and_then(|m| m.as_array()) {
        for (i, js_mask) in js_masks.iter().enumerate().take(16) {
            let adj = &js_mask["adjustments"];
            let geo = &js_mask["geometry"];
            let mask_type_str = js_mask["type"].as_str().unwrap_or("");

            let mask_type = match mask_type_str {
                "radial" => 1,
                "linear" => 2,
                _ => 0,
            };

            masks[i] = Mask {
                mask_type,
                invert: if js_mask["invert"].as_bool().unwrap_or(false) { 1 } else { 0 },
                feather: js_mask["feather"].as_f64().unwrap_or(0.5) as f32,
                rotation: js_mask["rotation"].as_f64().unwrap_or(0.0) as f32,
                center_x: geo["x"].as_f64().unwrap_or(0.0) as f32,
                center_y: geo["y"].as_f64().unwrap_or(0.0) as f32,
                radius_x: geo["radiusX"].as_f64().unwrap_or(0.0) as f32,
                radius_y: geo["radiusY"].as_f64().unwrap_or(0.0) as f32,
                start_x: geo["startX"].as_f64().unwrap_or(0.0) as f32,
                start_y: geo["startY"].as_f64().unwrap_or(0.0) as f32,
                end_x: geo["endX"].as_f64().unwrap_or(0.0) as f32,
                end_y: geo["endY"].as_f64().unwrap_or(0.0) as f32,
                exposure: adj["exposure"].as_f64().unwrap_or(0.0) as f32 / 100.0,
                contrast: adj["contrast"].as_f64().unwrap_or(0.0) as f32 / 200.0,
                highlights: adj["highlights"].as_f64().unwrap_or(0.0) as f32 / 200.0,
                shadows: adj["shadows"].as_f64().unwrap_or(0.0) as f32 / 200.0,
                whites: adj["whites"].as_f64().unwrap_or(0.0) as f32 / 300.0,
                blacks: adj["blacks"].as_f64().unwrap_or(0.0) as f32 / 300.0,
                saturation: adj["saturation"].as_f64().unwrap_or(0.0) as f32 / 200.0,
                temperature: adj["temperature"].as_f64().unwrap_or(0.0) as f32 / 250.0,
                tint: adj["tint"].as_f64().unwrap_or(0.0) as f32 / 250.0,
                vibrance: adj["vibrance"].as_f64().unwrap_or(0.0) as f32 / 200.0,
                _pad1: 0.0, _pad2: 0.0,
            };
            mask_count += 1;
        }
    }

    AllAdjustments {
        global,
        masks,
        mask_count,
        crop_x: crop_x.round() as u32,
        crop_y: crop_y.round() as u32,
        preview_scale,
        tile_offset_x: 0,
        tile_offset_y: 0,
        _pad1: 0,
        _pad2: 0,
    }
}

#[derive(Clone)]
pub struct GpuContext {
    pub device: Arc<wgpu::Device>,
    pub queue: Arc<wgpu::Queue>,
    pub limits: wgpu::Limits,
}

pub fn get_or_init_gpu_context(state: &tauri::State<AppState>) -> Result<GpuContext, String> {
    let mut context_lock = state.gpu_context.lock().unwrap();
    if let Some(context) = &*context_lock {
        return Ok(context.clone());
    }
    let instance = wgpu::Instance::new(wgpu::InstanceDescriptor::default());
    let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions::default()))
        .ok_or("Failed to find a wgpu adapter.")?;

    let limits = adapter.limits();

    let (device, queue) = pollster::block_on(adapter.request_device(
        &wgpu::DeviceDescriptor {
            label: Some("Processing Device"),
            required_features: wgpu::Features::empty(),
            required_limits: limits.clone(),
        },
        None,
    )).map_err(|e| e.to_string())?;

    let new_context = GpuContext {
        device: Arc::new(device),
        queue: Arc::new(queue),
        limits,
    };
    *context_lock = Some(new_context.clone());
    Ok(new_context)
}

fn read_texture_data(
    device: &wgpu::Device,
    queue: &wgpu::Queue,
    texture: &wgpu::Texture,
    size: wgpu::Extent3d,
) -> Result<Vec<u8>, String> {
    let unpadded_bytes_per_row = 4 * size.width;
    let align = wgpu::COPY_BYTES_PER_ROW_ALIGNMENT;
    let padded_bytes_per_row = (unpadded_bytes_per_row + align - 1) & !(align - 1);
    let output_buffer_size = (padded_bytes_per_row * size.height) as u64;

    let output_buffer = device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("Readback Buffer"),
        size: output_buffer_size,
        usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
        mapped_at_creation: false,
    });

    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: Some("Readback Encoder") });
    encoder.copy_texture_to_buffer(
        wgpu::ImageCopyTexture { texture, mip_level: 0, origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All },
        wgpu::ImageCopyBuffer {
            buffer: &output_buffer,
            layout: wgpu::ImageDataLayout { offset: 0, bytes_per_row: Some(padded_bytes_per_row), rows_per_image: Some(size.height) },
        },
        size,
    );

    queue.submit(Some(encoder.finish()));
    let buffer_slice = output_buffer.slice(..);
    let (tx, rx) = std::sync::mpsc::channel();
    buffer_slice.map_async(wgpu::MapMode::Read, move |result| { tx.send(result).unwrap(); });
    device.poll(wgpu::Maintain::Wait);
    rx.recv().unwrap().map_err(|e| e.to_string())?;

    let padded_data = buffer_slice.get_mapped_range().to_vec();
    output_buffer.unmap();

    if padded_bytes_per_row == unpadded_bytes_per_row {
        Ok(padded_data)
    } else {
        let mut unpadded_data = Vec::with_capacity((unpadded_bytes_per_row * size.height) as usize);
        for chunk in padded_data.chunks(padded_bytes_per_row as usize) {
            unpadded_data.extend_from_slice(&chunk[..unpadded_bytes_per_row as usize]);
        }
        Ok(unpadded_data)
    }
}

pub fn run_gpu_processing(
    context: &GpuContext,
    image: &DynamicImage,
    adjustments: AllAdjustments,
) -> Result<Vec<u8>, String> {
    let device = &context.device;
    let queue = &context.queue;
    let (width, height) = image.dimensions();
    let max_dim = context.limits.max_texture_dimension_2d;

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

    let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
        label: Some("Pipeline Layout"),
        bind_group_layouts: &[&bind_group_layout],
        push_constant_ranges: &[],
    });

    let compute_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
        label: Some("Compute Pipeline"), layout: Some(&pipeline_layout),
        module: &shader_module, entry_point: "main",
    });

    if width <= max_dim && height <= max_dim {
        let img_rgba = image.to_rgba8();
        let texture_size = wgpu::Extent3d { width, height, depth_or_array_layers: 1 };

        let adjustments_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Adjustments Buffer"),
            contents: bytemuck::bytes_of(&adjustments),
            usage: wgpu::BufferUsages::UNIFORM,
        });

        let input_texture = device.create_texture_with_data(
            queue,
            &wgpu::TextureDescriptor {
                label: Some("Input Texture"), size: texture_size, mip_level_count: 1, sample_count: 1,
                dimension: wgpu::TextureDimension::D2, format: wgpu::TextureFormat::Rgba8Unorm,
                usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST, view_formats: &[],
            },
            TextureDataOrder::MipMajor, &img_rgba,
        );

        let output_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Output Texture"), size: texture_size, mip_level_count: 1, sample_count: 1,
            dimension: wgpu::TextureDimension::D2, format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::COPY_SRC, view_formats: &[],
        });

        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Single Texture Bind Group"), layout: &bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(&input_texture.create_view(&Default::default())) },
                wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::TextureView(&output_texture.create_view(&Default::default())) },
                wgpu::BindGroupEntry { binding: 2, resource: adjustments_buffer.as_entire_binding() },
            ],
        });

        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: None });
        {
            let mut compute_pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor { label: None, timestamp_writes: None });
            compute_pass.set_pipeline(&compute_pipeline);
            compute_pass.set_bind_group(0, &bind_group, &[]);
            compute_pass.dispatch_workgroups((width + 7) / 8, (height + 7) / 8, 1);
        }

        queue.submit(Some(encoder.finish()));
        return read_texture_data(device, queue, &output_texture, texture_size);
    }

    let tile_size = (max_dim / 2).min(2048);
    let img_rgba = image.to_rgba8();
    let mut final_pixels = vec![0u8; (width * height * 4) as usize];

    let tiles_x = (width + tile_size - 1) / tile_size;
    let tiles_y = (height + tile_size - 1) / tile_size;

    let raw_buffer = img_rgba.as_raw();

    for tile_y in 0..tiles_y {
        for tile_x in 0..tiles_x {
            let x_start = tile_x * tile_size;
            let y_start = tile_y * tile_size;
            let x_end = (x_start + tile_size).min(width);
            let y_end = (y_start + tile_size).min(height);

            let tile_width = x_end - x_start;
            let tile_height = y_end - y_start;

            let mut tile_pixels = Vec::with_capacity((tile_width * tile_height * 4) as usize);

            for y in y_start..y_end {
                let pixel_row_start = (y * width + x_start) as usize * 4;
                let pixel_row_end = pixel_row_start + (tile_width as usize * 4);
                tile_pixels.extend_from_slice(&raw_buffer[pixel_row_start..pixel_row_end]);
            }

            let texture_size = wgpu::Extent3d { width: tile_width, height: tile_height, depth_or_array_layers: 1 };

            let mut tile_adjustments = adjustments;
            tile_adjustments.tile_offset_x = x_start;
            tile_adjustments.tile_offset_y = y_start;

            let adjustments_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Tile Adjustments Buffer"),
                contents: bytemuck::bytes_of(&tile_adjustments),
                usage: wgpu::BufferUsages::UNIFORM,
            });

            let input_texture = device.create_texture_with_data(
                queue,
                &wgpu::TextureDescriptor {
                    label: Some("Input Tile Texture"), size: texture_size, mip_level_count: 1, sample_count: 1,
                    dimension: wgpu::TextureDimension::D2, format: wgpu::TextureFormat::Rgba8Unorm,
                    usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST, view_formats: &[],
                },
                TextureDataOrder::MipMajor, &tile_pixels,
            );

            let output_texture = device.create_texture(&wgpu::TextureDescriptor {
                label: Some("Output Tile Texture"), size: texture_size, mip_level_count: 1, sample_count: 1,
                dimension: wgpu::TextureDimension::D2, format: wgpu::TextureFormat::Rgba8Unorm,
                usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::COPY_SRC, view_formats: &[],
            });

            let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("Tile Bind Group"), layout: &bind_group_layout,
                entries: &[
                    wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(&input_texture.create_view(&Default::default())) },
                    wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::TextureView(&output_texture.create_view(&Default::default())) },
                    wgpu::BindGroupEntry { binding: 2, resource: adjustments_buffer.as_entire_binding() },
                ],
            });

            let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: Some("Tile Encoder") });
            {
                let mut compute_pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor { label: None, timestamp_writes: None });
                compute_pass.set_pipeline(&compute_pipeline);
                compute_pass.set_bind_group(0, &bind_group, &[]);
                compute_pass.dispatch_workgroups((tile_width + 7) / 8, (tile_height + 7) / 8, 1);
            }
            queue.submit(Some(encoder.finish()));

            let processed_tile_data = read_texture_data(device, queue, &output_texture, texture_size)?;

            for row in 0..tile_height {
                let final_y = y_start + row;
                let final_row_offset = (final_y * width + x_start) as usize * 4;
                let tile_row_offset = (row * tile_width) as usize * 4;
                let copy_bytes = (tile_width * 4) as usize;

                final_pixels[final_row_offset..final_row_offset + copy_bytes]
                    .copy_from_slice(&processed_tile_data[tile_row_offset..tile_row_offset + copy_bytes]);
            }
        }
    }

    Ok(final_pixels)
}

pub fn process_and_get_dynamic_image(
    context: &GpuContext,
    base_image: &DynamicImage,
    all_adjustments: AllAdjustments,
) -> Result<DynamicImage, String> {
    let processed_pixels = run_gpu_processing(context, base_image, all_adjustments)?;
    let (width, height) = base_image.dimensions();
    let img_buf = ImageBuffer::<Rgba<u8>, Vec<u8>>::from_raw(width, height, processed_pixels)
        .ok_or("Failed to create image buffer from GPU data")?;
    Ok(DynamicImage::ImageRgba8(img_buf))
}

#[derive(Serialize, Clone)]
pub struct HistogramData {
    red: Vec<u32>,
    green: Vec<u32>,
    blue: Vec<u32>,
    luma: Vec<u32>,
}

#[tauri::command]
pub fn generate_histogram(state: tauri::State<AppState>) -> Result<HistogramData, String> {
    let image = state.original_image.lock().unwrap().clone()
        .ok_or("No image loaded to generate histogram")?;

    let preview = image.thumbnail(512, 512);

    let mut red = vec![0; 256];
    let mut green = vec![0; 256];
    let mut blue = vec![0; 256];
    let mut luma = vec![0; 256];

    for pixel in preview.to_rgb8().pixels() {
        let r = pixel[0] as usize;
        let g = pixel[1] as usize;
        let b = pixel[2] as usize;

        red[r] += 1;
        green[g] += 1;
        blue[b] += 1;

        let l = (0.299 * r as f32 + 0.587 * g as f32 + 0.114 * b as f32).round() as usize;
        if l < 256 {
            luma[l] += 1;
        }
    }

    Ok(HistogramData { red, green, blue, luma })
}

// This function replaces the old `generate_processed_histogram` command.
// It no longer runs a GPU pipeline and instead calculates a histogram
// from an already-processed image.
pub fn calculate_histogram_from_image(image: &DynamicImage) -> Result<HistogramData, String> {
    // Create a smaller thumbnail for faster histogram calculation,
    // consistent with the original image histogram.
    let preview = image.thumbnail(512, 512);

    let mut red = vec![0; 256];
    let mut green = vec![0; 256];
    let mut blue = vec![0; 256];
    let mut luma = vec![0; 256];

    for pixel in preview.to_rgb8().pixels() {
        let r = pixel[0] as usize;
        let g = pixel[1] as usize;
        let b = pixel[2] as usize;

        red[r] += 1;
        green[g] += 1;
        blue[b] += 1;

        let l = (0.299 * r as f32 + 0.587 * g as f32 + 0.114 * b as f32).round() as usize;
        if l < 256 {
            luma[l] += 1;
        }
    }

    Ok(HistogramData { red, green, blue, luma })
}