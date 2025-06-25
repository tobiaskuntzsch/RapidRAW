use image::{GrayImage, Luma, ImageBuffer};
use imageproc::drawing::{draw_filled_ellipse_mut, draw_line_segment_mut};
use imageproc::filter::gaussian_blur_f32;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::f32::consts::PI;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MaskDefinition {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub mask_type: String,
    pub visible: bool,
    pub invert: bool,
    pub adjustments: Value,
    pub parameters: Value,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct RadialMaskParameters {
    center_x: f64,
    center_y: f64,
    radius_x: f64,
    radius_y: f64,
    rotation: f32,
    feather: f32,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct LinearMaskParameters {
    start_x: f64,
    start_y: f64,
    end_x: f64,
    end_y: f64,
    feather: f32,
}

fn generate_radial_bitmap(
    params_value: &Value,
    width: u32,
    height: u32,
    scale: f32,
    crop_offset: (f32, f32),
) -> GrayImage {
    let params: RadialMaskParameters = serde_json::from_value(params_value.clone()).unwrap_or_default();
    let mut mask = GrayImage::new(width, height);

    let center_x = (params.center_x as f32 * scale - crop_offset.0) as i32;
    let center_y = (params.center_y as f32 * scale - crop_offset.1) as i32;
    let radius_x = params.radius_x as f32 * scale;
    let radius_y = params.radius_y as f32 * scale;
    let rotation_rad = params.rotation * PI / 180.0;

    for y in 0..height {
        for x in 0..width {
            let dx = x as f32 - center_x as f32;
            let dy = y as f32 - center_y as f32;

            let cos_rot = rotation_rad.cos();
            let sin_rot = rotation_rad.sin();

            let rot_dx = dx * cos_rot + dy * sin_rot;
            let rot_dy = -dx * sin_rot + dy * cos_rot;

            let norm_x = rot_dx / radius_x.max(0.01);
            let norm_y = rot_dy / radius_y.max(0.01);

            let dist = (norm_x.powi(2) + norm_y.powi(2)).sqrt();
            
            let inner_bound = 1.0 - params.feather.clamp(0.0, 1.0);
            let intensity = 1.0 - (dist - inner_bound) / (1.0 - inner_bound).max(0.01);
            let clamped_intensity = intensity.clamp(0.0, 1.0);

            mask.put_pixel(x, y, Luma([(clamped_intensity * 255.0) as u8]));
        }
    }

    mask
}

fn generate_linear_bitmap(
    params_value: &Value,
    width: u32,
    height: u32,
    scale: f32,
    crop_offset: (f32, f32),
) -> GrayImage {
    let params: LinearMaskParameters = serde_json::from_value(params_value.clone()).unwrap_or_default();
    let mut mask = GrayImage::new(width, height);

    let start_x = params.start_x as f32 * scale - crop_offset.0;
    let start_y = params.start_y as f32 * scale - crop_offset.1;
    let end_x = params.end_x as f32 * scale - crop_offset.0;
    let end_y = params.end_y as f32 * scale - crop_offset.1;

    let gradient_vec = (end_x - start_x, end_y - start_y);
    let len_sq = gradient_vec.0.powi(2) + gradient_vec.1.powi(2);

    if len_sq < 0.01 {
        return mask;
    }

    for y in 0..height {
        for x in 0..width {
            let pixel_vec = (x as f32 - start_x, y as f32 - start_y);
            let t = (pixel_vec.0 * gradient_vec.0 + pixel_vec.1 * gradient_vec.1) / len_sq;
            
            let half_feather = params.feather * 0.5;
            let intensity = (t - (0.0 - half_feather)) / (half_feather * 2.0) - (t - (1.0 - half_feather)) / (half_feather * 2.0).max(0.01);
            let clamped_intensity = intensity.clamp(0.0, 1.0);

            mask.put_pixel(x, y, Luma([(clamped_intensity * 255.0) as u8]));
        }
    }

    mask
}

pub fn generate_mask_bitmap(
    mask_def: &MaskDefinition,
    width: u32,
    height: u32,
    scale: f32,
    crop_offset: (f32, f32),
) -> Option<GrayImage> {
    if !mask_def.visible {
        return None;
    }

    match mask_def.mask_type.as_str() {
        "radial" => Some(generate_radial_bitmap(&mask_def.parameters, width, height, scale, crop_offset)),
        "linear" => Some(generate_linear_bitmap(&mask_def.parameters, width, height, scale, crop_offset)),
        // "brush" => generate_brush_bitmap(...),
        // "ai-subject" => generate_ai_subject_bitmap(...),
        _ => None,
    }
}