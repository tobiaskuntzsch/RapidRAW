use image::{GrayImage, Luma};
use imageproc::drawing::{draw_filled_ellipse_mut};
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

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct LinearMaskParameters {
    start_x: f64,
    start_y: f64,
    end_x: f64,
    end_y: f64,
    #[serde(default = "default_range")]
    range: f32,
}

fn default_range() -> f32 {
    50.0
}

impl Default for LinearMaskParameters {
    fn default() -> Self {
        Self {
            start_x: 0.0,
            start_y: 0.0,
            end_x: 0.0,
            end_y: 0.0,
            range: default_range(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Point {
    x: f64,
    y: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct BrushLine {
    tool: String,
    brush_size: f32,
    points: Vec<Point>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct BrushMaskParameters {
    #[serde(default)]
    lines: Vec<BrushLine>,
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

    let center_x = ((params.center_x as f32 - crop_offset.0) * scale) as i32;
    let center_y = ((params.center_y as f32 - crop_offset.1) * scale) as i32;
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

    let start_x = (params.start_x as f32 - crop_offset.0) * scale;
    let start_y = (params.start_y as f32 - crop_offset.1) * scale;
    let end_x = (params.end_x as f32 - crop_offset.0) * scale;
    let end_y = (params.end_y as f32 - crop_offset.1) * scale;
    let range = params.range * scale;

    let line_vec_x = end_x - start_x;
    let line_vec_y = end_y - start_y;

    let len_sq = line_vec_x.powi(2) + line_vec_y.powi(2);

    if len_sq < 0.01 {
        return mask;
    }

    let perp_vec_x = -line_vec_y / len_sq.sqrt();
    let perp_vec_y = line_vec_x / len_sq.sqrt();

    let half_width = range.max(0.01);

    for y_u in 0..height {
        for x_u in 0..width {
            let x = x_u as f32;
            let y = y_u as f32;

            let pixel_vec_x = x - start_x;
            let pixel_vec_y = y - start_y;

            let dist_perp = pixel_vec_x * perp_vec_x + pixel_vec_y * perp_vec_y;

            let t = dist_perp / half_width;

            let intensity = 0.5 - t * 0.5;
            
            let clamped_intensity = intensity.clamp(0.0, 1.0);

            mask.put_pixel(x_u, y_u, Luma([(clamped_intensity * 255.0) as u8]));
        }
    }

    mask
}

fn generate_brush_bitmap(
    params_value: &Value,
    width: u32,
    height: u32,
    scale: f32,
    crop_offset: (f32, f32),
) -> GrayImage {
    let params: BrushMaskParameters = serde_json::from_value(params_value.clone()).unwrap_or_default();
    let mut mask = GrayImage::new(width, height);

    for line in &params.lines {
        if line.points.is_empty() { continue; }

        let color = if line.tool == "eraser" { Luma([0u8]) } else { Luma([255u8]) };
        let radius = (line.brush_size * scale / 2.0).max(0.0);

        if line.points.len() > 1 {
            for points_pair in line.points.windows(2) {
                let p1 = &points_pair[0];
                let p2 = &points_pair[1];

                let x1_f = (p1.x as f32 - crop_offset.0) * scale;
                let y1_f = (p1.y as f32 - crop_offset.1) * scale;
                let x2_f = (p2.x as f32 - crop_offset.0) * scale;
                let y2_f = (p2.y as f32 - crop_offset.1) * scale;

                let dist = ((x2_f - x1_f).powi(2) + (y2_f - y1_f).powi(2)).sqrt();
                let steps = (dist / (radius.min(1.0).max(0.5))).ceil() as i32;
                
                if steps > 1 {
                    for i in 0..steps {
                        let t = i as f32 / (steps - 1) as f32;
                        let interp_x = (x1_f + t * (x2_f - x1_f)) as i32;
                        let interp_y = (y1_f + t * (y2_f - y1_f)) as i32;
                        draw_filled_ellipse_mut(&mut mask, (interp_x, interp_y), radius as i32, radius as i32, color);
                    }
                } else {
                    draw_filled_ellipse_mut(&mut mask, (x1_f as i32, y1_f as i32), radius as i32, radius as i32, color);
                    draw_filled_ellipse_mut(&mut mask, (x2_f as i32, y2_f as i32), radius as i32, radius as i32, color);
                }
            }
        } else {
            let p1 = &line.points[0];
            let x1 = ((p1.x as f32 - crop_offset.0) * scale) as i32;
            let y1 = ((p1.y as f32 - crop_offset.1) * scale) as i32;
            draw_filled_ellipse_mut(&mut mask, (x1, y1), radius as i32, radius as i32, color);
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

    let mut base_mask = match mask_def.mask_type.as_str() {
        "radial" => Some(generate_radial_bitmap(&mask_def.parameters, width, height, scale, crop_offset)),
        "linear" => Some(generate_linear_bitmap(&mask_def.parameters, width, height, scale, crop_offset)),
        "brush" => Some(generate_brush_bitmap(&mask_def.parameters, width, height, scale, crop_offset)),
        _ => None,
    };

    if let Some(mask) = &mut base_mask {
        if mask_def.invert {
            for pixel in mask.pixels_mut() {
                pixel[0] = 255 - pixel[0];
            }
        }
    }

    base_mask
}