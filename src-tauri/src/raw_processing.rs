use anyhow::Result;
use image::{DynamicImage, ImageBuffer, Rgb, RgbImage};
use rawloader::RawImageData;
use rayon::prelude::*;
use std::io::Cursor;

// --- Enums and Constants ---

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize)]
pub enum DemosaicAlgorithm {
    Linear,
    Menon,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum BayerPattern {
    RGGB,
    BGGR,
    GRBG,
    GBRG,
}

enum Axis {
    Horizontal,
    Vertical,
}

const K_B: [f32; 3] = [0.5, 0.0, 0.5];

// #############################################################################
// FAST PREVIEW / THUMBNAIL HELPERS
// #############################################################################

fn downscale_and_demosaic_2x2(
    raw_data: &[u16],
    raw_width: u32,
    crop_left: u32,
    crop_top: u32,
    final_width: u32,
    final_height: u32,
    pattern: BayerPattern,
) -> ImageBuffer<Rgb<f32>, Vec<f32>> {
    let new_width = final_width / 2;
    let new_height = final_height / 2;
    let mut out_buffer = ImageBuffer::<Rgb<f32>, Vec<f32>>::new(new_width, new_height);

    for y in 0..new_height {
        for x in 0..new_width {
            let orig_x = x * 2 + crop_left;
            let orig_y = y * 2 + crop_top;

            let p1_idx = (orig_y * raw_width + orig_x) as usize;
            let p2_idx = (orig_y * raw_width + orig_x + 1) as usize;
            let p3_idx = ((orig_y + 1) * raw_width + orig_x) as usize;
            let p4_idx = ((orig_y + 1) * raw_width + orig_x + 1) as usize;

            let (r, g1, g2, b) = match pattern {
                BayerPattern::RGGB => (raw_data[p1_idx], raw_data[p2_idx], raw_data[p3_idx], raw_data[p4_idx]),
                BayerPattern::BGGR => (raw_data[p4_idx], raw_data[p2_idx], raw_data[p3_idx], raw_data[p1_idx]),
                BayerPattern::GRBG => (raw_data[p2_idx], raw_data[p1_idx], raw_data[p4_idx], raw_data[p3_idx]),
                BayerPattern::GBRG => (raw_data[p3_idx], raw_data[p1_idx], raw_data[p4_idx], raw_data[p2_idx]),
            };

            let r_f = r as f32;
            let g_f = (g1 as f32 + g2 as f32) / 2.0;
            let b_f = b as f32;

            out_buffer.put_pixel(x, y, Rgb([r_f, g_f, b_f]));
        }
    }
    out_buffer
}

fn downscale_and_demosaic_4x4(
    raw_data: &[u16],
    raw_width: u32,
    crop_left: u32,
    crop_top: u32,
    final_width: u32,
    final_height: u32,
    pattern: BayerPattern,
) -> ImageBuffer<Rgb<f32>, Vec<f32>> {
    let new_width = final_width / 4;
    let new_height = final_height / 4;
    let mut out_buffer = ImageBuffer::<Rgb<f32>, Vec<f32>>::new(new_width, new_height);

    let get_color_at = |px: u32, py: u32| -> char {
        let (is_red_row, is_red_col) = match pattern {
            BayerPattern::RGGB => (py % 2 == 0, px % 2 == 0),
            BayerPattern::BGGR => (py % 2 == 1, px % 2 == 1),
            BayerPattern::GRBG => (py % 2 == 0, px % 2 == 1),
            BayerPattern::GBRG => (py % 2 == 1, px % 2 == 0),
        };
        if is_red_row == is_red_col { if is_red_row { 'R' } else { 'B' } } else { 'G' }
    };

    for y in 0..new_height {
        for x in 0..new_width {
            let orig_base_x = x * 4 + crop_left;
            let orig_base_y = y * 4 + crop_top;

            let mut r_sum = 0.0;
            let mut g_sum = 0.0;
            let mut b_sum = 0.0;
            let (mut r_count, mut g_count, mut b_count) = (0, 0, 0);

            for dy in 0..4 {
                for dx in 0..4 {
                    let current_x = orig_base_x + dx;
                    let current_y = orig_base_y + dy;
                    
                    if current_x < (crop_left + final_width) && current_y < (crop_top + final_height) {
                        let color = get_color_at(current_x, current_y);
                        let pixel_idx = (current_y * raw_width + current_x) as usize;
                        let val = raw_data[pixel_idx] as f32;
                        match color {
                            'R' => { r_sum += val; r_count += 1; },
                            'G' => { g_sum += val; g_count += 1; },
                            'B' => { b_sum += val; b_count += 1; },
                            _ => {}
                        }
                    }
                }
            }

            let r_avg = if r_count > 0 { r_sum / r_count as f32 } else { 0.0 };
            let g_avg = if g_count > 0 { g_sum / g_count as f32 } else { 0.0 };
            let b_avg = if b_count > 0 { b_sum / b_count as f32 } else { 0.0 };

            out_buffer.put_pixel(x, y, Rgb([r_avg, g_avg, b_avg]));
        }
    }
    out_buffer
}

// #############################################################################
// PUBLIC API FUNCTIONS
// #############################################################################

pub fn develop_raw_thumbnail(file_bytes: &[u8]) -> Result<DynamicImage> {
    // --- Configuration ---
    let exposure_compensation = 4.5; 
    let contrast_factor = 1.6;
    let saturation_factor = 1.3;

    // --- Load and Extract Metadata ---
    let raw_image = rawloader::decode(&mut Cursor::new(file_bytes))?;

    let raw_width = raw_image.width as u32;
    let raw_height = raw_image.height as u32;
    let crops = raw_image.crops;
    let crop_top = crops[0] as u32;
    let crop_right = crops[1] as u32;
    let crop_bottom = crops[2] as u32;
    let crop_left = crops[3] as u32;
    let final_width = raw_width - crop_left - crop_right;
    let final_height = raw_height - crop_top - crop_bottom;
    let bayer_pattern = match raw_image.cfa.to_string().as_str() {
        "RGGB" => BayerPattern::RGGB, "BGGR" => BayerPattern::BGGR,
        "GRBG" => BayerPattern::GRBG, "GBRG" => BayerPattern::GBRG,
        _ => BayerPattern::RGGB,
    };
    let wb_coeffs_raw = raw_image.wb_coeffs;
    let final_wb_coeffs = if wb_coeffs_raw[1].abs() > 0.0001 {
        [wb_coeffs_raw[0] / wb_coeffs_raw[1], 1.0, wb_coeffs_raw[2] / wb_coeffs_raw[1]]
    } else { [1.0, 1.0, 1.0] };
    let black_levels = [raw_image.blacklevels[0] as f32, raw_image.blacklevels[1] as f32, raw_image.blacklevels[2] as f32];
    let white_levels = [raw_image.whitelevels[0] as f32, raw_image.whitelevels[1] as f32, raw_image.whitelevels[2] as f32];
    let dynamic_ranges = [
        (white_levels[0] - black_levels[0]).max(1.0),
        (white_levels[1] - black_levels[1]).max(1.0),
        (white_levels[2] - black_levels[2]).max(1.0),
    ];
    let cam_to_xyz = raw_image.cam_to_xyz_normalized();
    const XYZ_TO_SRGB: [[f32; 3]; 3] = [
        [ 3.2404542, -1.5371385, -0.4985314],
        [-0.9692660,  1.8760108,  0.0415560],
        [ 0.0556434, -0.2040259,  1.0572252],
    ];
    let mut cam_to_srgb = [[0.0; 3]; 3];
    for i in 0..3 {
        for j in 0..3 {
            cam_to_srgb[i][j] = XYZ_TO_SRGB[i][0] * cam_to_xyz[0][j]
                             + XYZ_TO_SRGB[i][1] * cam_to_xyz[1][j]
                             + XYZ_TO_SRGB[i][2] * cam_to_xyz[2][j];
        }
    }

    // --- Now, move the data vector out of the struct ---
    let data = match raw_image.data {
        RawImageData::Integer(d) => d,
        _ => return Err(anyhow::anyhow!("Only integer-based RAW data is supported.")),
    };

    // --- Demosaic and Post-Process ---
    let fast_preview_buffer = downscale_and_demosaic_4x4(&data, raw_width, crop_left, crop_top, final_width, final_height, bayer_pattern);
    let (new_width, new_height) = fast_preview_buffer.dimensions();
    let mut final_image_buffer = ImageBuffer::<Rgb<u8>, Vec<u8>>::new(new_width, new_height);

    for (x, y, pixel) in fast_preview_buffer.enumerate_pixels() {
        let (r, g, b) = post_process_pixel(
            pixel[0], pixel[1], pixel[2], 
            &black_levels, &dynamic_ranges, &final_wb_coeffs, &cam_to_srgb,
            exposure_compensation, contrast_factor, saturation_factor,
        );
        final_image_buffer.put_pixel(x, y, Rgb([r, g, b]));
    }

    Ok(DynamicImage::ImageRgb8(final_image_buffer))
}

pub fn develop_raw_fast_preview(file_bytes: &[u8]) -> Result<DynamicImage> {
    // --- Configuration ---
    let exposure_compensation = 4.5; 
    let contrast_factor = 1.6;
    let saturation_factor = 1.3;

    // --- Load and Extract Metadata ---
    let raw_image = rawloader::decode(&mut Cursor::new(file_bytes))?;

    let raw_width = raw_image.width as u32;
    let raw_height = raw_image.height as u32;
    let crops = raw_image.crops;
    let crop_top = crops[0] as u32;
    let crop_right = crops[1] as u32;
    let crop_bottom = crops[2] as u32;
    let crop_left = crops[3] as u32;
    let final_width = raw_width - crop_left - crop_right;
    let final_height = raw_height - crop_top - crop_bottom;
    let bayer_pattern = match raw_image.cfa.to_string().as_str() {
        "RGGB" => BayerPattern::RGGB, "BGGR" => BayerPattern::BGGR,
        "GRBG" => BayerPattern::GRBG, "GBRG" => BayerPattern::GBRG,
        _ => BayerPattern::RGGB,
    };
    let wb_coeffs_raw = raw_image.wb_coeffs;
    let final_wb_coeffs = if wb_coeffs_raw[1].abs() > 0.0001 {
        [wb_coeffs_raw[0] / wb_coeffs_raw[1], 1.0, wb_coeffs_raw[2] / wb_coeffs_raw[1]]
    } else { [1.0, 1.0, 1.0] };
    let black_levels = [raw_image.blacklevels[0] as f32, raw_image.blacklevels[1] as f32, raw_image.blacklevels[2] as f32];
    let white_levels = [raw_image.whitelevels[0] as f32, raw_image.whitelevels[1] as f32, raw_image.whitelevels[2] as f32];
    let dynamic_ranges = [
        (white_levels[0] - black_levels[0]).max(1.0),
        (white_levels[1] - black_levels[1]).max(1.0),
        (white_levels[2] - black_levels[2]).max(1.0),
    ];
    let cam_to_xyz = raw_image.cam_to_xyz_normalized();
    const XYZ_TO_SRGB: [[f32; 3]; 3] = [
        [ 3.2404542, -1.5371385, -0.4985314],
        [-0.9692660,  1.8760108,  0.0415560],
        [ 0.0556434, -0.2040259,  1.0572252],
    ];
    let mut cam_to_srgb = [[0.0; 3]; 3];
    for i in 0..3 {
        for j in 0..3 {
            cam_to_srgb[i][j] = XYZ_TO_SRGB[i][0] * cam_to_xyz[0][j]
                             + XYZ_TO_SRGB[i][1] * cam_to_xyz[1][j]
                             + XYZ_TO_SRGB[i][2] * cam_to_xyz[2][j];
        }
    }

    // --- Now, move the data vector out of the struct ---
    let data = match raw_image.data {
        RawImageData::Integer(d) => d,
        _ => return Err(anyhow::anyhow!("Only integer-based RAW data is supported.")),
    };

    // --- Demosaic and Post-Process ---
    let fast_preview_buffer = downscale_and_demosaic_2x2(&data, raw_width, crop_left, crop_top, final_width, final_height, bayer_pattern);
    let (new_width, new_height) = fast_preview_buffer.dimensions();
    let mut final_image_buffer = ImageBuffer::<Rgb<u8>, Vec<u8>>::new(new_width, new_height);

    for (x, y, pixel) in fast_preview_buffer.enumerate_pixels() {
        let (r, g, b) = post_process_pixel(
            pixel[0], pixel[1], pixel[2], 
            &black_levels, &dynamic_ranges, &final_wb_coeffs, &cam_to_srgb,
            exposure_compensation, contrast_factor, saturation_factor,
        );
        final_image_buffer.put_pixel(x, y, Rgb([r, g, b]));
    }

    Ok(DynamicImage::ImageRgb8(final_image_buffer))
}

pub fn develop_raw_image(
    file_bytes: &[u8],
    algorithm: DemosaicAlgorithm,
) -> Result<DynamicImage, String> {
    // --- Configuration ---
    let exposure_compensation = 4.5; 
    let contrast_factor = 1.6;
    let saturation_factor = 1.3;
    let use_menon_refining_step = true;

    // --- Load and Extract Metadata ---
    let raw_image = rawloader::decode(&mut Cursor::new(file_bytes))
        .map_err(|e| format!("Failed to decode RAW file: {}", e))?;

    let raw_width = raw_image.width as u32;
    let raw_height = raw_image.height as u32;
    let crops = raw_image.crops;
    let crop_top = crops[0] as u32;
    let crop_right = crops[1] as u32;
    let crop_bottom = crops[2] as u32;
    let crop_left = crops[3] as u32;
    let final_width = raw_width - crop_left - crop_right;
    let final_height = raw_height - crop_top - crop_bottom;
    let bayer_pattern = match raw_image.cfa.to_string().as_str() {
        "RGGB" => BayerPattern::RGGB, "BGGR" => BayerPattern::BGGR,
        "GRBG" => BayerPattern::GRBG, "GBRG" => BayerPattern::GBRG,
        p => { println!("Unknown CFA pattern '{}', defaulting to RGGB", p); BayerPattern::RGGB }
    };
    let wb_coeffs_raw = raw_image.wb_coeffs;
    let final_wb_coeffs = if wb_coeffs_raw[1].abs() > 0.0001 {
        [wb_coeffs_raw[0] / wb_coeffs_raw[1], 1.0, wb_coeffs_raw[2] / wb_coeffs_raw[1]]
    } else { [1.0, 1.0, 1.0] };
    let black_levels = [raw_image.blacklevels[0] as f32, raw_image.blacklevels[1] as f32, raw_image.blacklevels[2] as f32];
    let white_levels = [raw_image.whitelevels[0] as f32, raw_image.whitelevels[1] as f32, raw_image.whitelevels[2] as f32];
    let dynamic_ranges = [
        (white_levels[0] - black_levels[0]).max(1.0),
        (white_levels[1] - black_levels[1]).max(1.0),
        (white_levels[2] - black_levels[2]).max(1.0),
    ];
    let cam_to_xyz = raw_image.cam_to_xyz_normalized();
    const XYZ_TO_SRGB: [[f32; 3]; 3] = [
        [ 3.2404542, -1.5371385, -0.4985314],
        [-0.9692660,  1.8760108,  0.0415560],
        [ 0.0556434, -0.2040259,  1.0572252],
    ];
    let mut cam_to_srgb = [[0.0; 3]; 3];
    for i in 0..3 {
        for j in 0..3 {
            cam_to_srgb[i][j] = XYZ_TO_SRGB[i][0] * cam_to_xyz[0][j]
                             + XYZ_TO_SRGB[i][1] * cam_to_xyz[1][j]
                             + XYZ_TO_SRGB[i][2] * cam_to_xyz[2][j];
        }
    }

    // --- Now, move the data vector out of the struct ---
    let data = match raw_image.data {
        RawImageData::Integer(d) => d,
        _ => return Err("Only integer-based RAW data is supported.".to_string()),
    };

    // --- Demosaic and Post-Process ---
    let mut img_buffer: RgbImage = ImageBuffer::new(final_width, final_height);

    match algorithm {
        DemosaicAlgorithm::Linear => {
            let buffer = img_buffer.as_mut();
            buffer.par_chunks_mut((final_width * 3) as usize).enumerate().for_each(|(y_out, row)| {
                for x_out in 0..final_width {
                    let x_raw = x_out + crop_left;
                    let y_raw = y_out as u32 + crop_top;

                    let (r_raw, g_raw, b_raw) = demosaic_pixel_optimized_linear(&data, x_raw, y_raw, raw_width, raw_height, bayer_pattern);
                    let (r_final, g_final, b_final) = post_process_pixel(
                        r_raw, g_raw, b_raw, 
                        &black_levels, &dynamic_ranges, &final_wb_coeffs, &cam_to_srgb,
                        exposure_compensation, contrast_factor, saturation_factor,
                    );
                    
                    let base = (x_out * 3) as usize;
                    row[base] = r_final;
                    row[base + 1] = g_final;
                    row[base + 2] = b_final;
                }
            });
        }
        DemosaicAlgorithm::Menon => {
            let rgb_f32_data = demosaic_menon2007(&data, raw_width, raw_height, bayer_pattern, use_menon_refining_step);
            
            let buffer = img_buffer.as_mut();
            buffer.par_chunks_mut((final_width * 3) as usize).enumerate().for_each(|(y_out, row_out)| {
                for x_out in 0..final_width {
                    let x_raw = x_out + crop_left;
                    let y_raw = y_out as u32 + crop_top;
                    let idx_in = (y_raw as usize * raw_width as usize + x_raw as usize) * 3;

                    let (r_final, g_final, b_final) = post_process_pixel(
                        rgb_f32_data[idx_in], rgb_f32_data[idx_in + 1], rgb_f32_data[idx_in + 2], 
                        &black_levels, &dynamic_ranges, &final_wb_coeffs, &cam_to_srgb,
                        exposure_compensation, contrast_factor, saturation_factor,
                    );
                    
                    let base = (x_out * 3) as usize;
                    row_out[base] = r_final;
                    row_out[base + 1] = g_final;
                    row_out[base + 2] = b_final;
                }
            });
        }
    }

    Ok(DynamicImage::ImageRgb8(img_buffer))
}

// #############################################################################
// CORE ALGORITHMS AND HELPERS
// #############################################################################

/// Final post-processing function with exposure, contrast, and saturation controls.
fn post_process_pixel(
    r_raw: f32, g_raw: f32, b_raw: f32,
    black_levels: &[f32; 3],
    dynamic_ranges: &[f32; 3],
    wb_coeffs: &[f32; 3],
    cam_to_srgb: &[[f32; 3]; 3],
    exposure: f32,
    contrast: f32,
    saturation: f32,
) -> (u8, u8, u8) {
    // 1. Black level subtraction and normalization (per-channel)
    let r_norm = ((r_raw - black_levels[0]) / dynamic_ranges[0]).max(0.0);
    let g_norm = ((g_raw - black_levels[1]) / dynamic_ranges[1]).max(0.0);
    let b_norm = ((b_raw - black_levels[2]) / dynamic_ranges[2]).max(0.0);

    // 2. White balance
    let r_wb = r_norm * wb_coeffs[0];
    let g_wb = g_norm * wb_coeffs[1];
    let b_wb = b_norm * wb_coeffs[2];

    // 3. Color space conversion (Camera Native -> sRGB)
    let r_srgb = r_wb * cam_to_srgb[0][0] + g_wb * cam_to_srgb[0][1] + b_wb * cam_to_srgb[0][2];
    let g_srgb = r_wb * cam_to_srgb[1][0] + g_wb * cam_to_srgb[1][1] + b_wb * cam_to_srgb[1][2];
    let b_srgb = r_wb * cam_to_srgb[2][0] + g_wb * cam_to_srgb[2][1] + b_wb * cam_to_srgb[2][2];

    // 4. Exposure compensation
    let r_exp = (r_srgb * exposure).max(0.0);
    let g_exp = (g_srgb * exposure).max(0.0);
    let b_exp = (b_srgb * exposure).max(0.0);

    // 5. Contrast (S-curve)
    fn apply_s_curve(val: f32, contrast_factor: f32) -> f32 {
        let x = val.clamp(0.0, 1.0);
        // A simple smoothstep curve
        let s_curve = x * x * (3.0 - 2.0 * x);
        // Linearly interpolate between original and curved value
        let amount = (contrast_factor - 1.0).clamp(0.0, 1.0); 
        x * (1.0 - amount) + s_curve * amount
    }
    let r_con = apply_s_curve(r_exp, contrast);
    let g_con = apply_s_curve(g_exp, contrast);
    let b_con = apply_s_curve(b_exp, contrast);

    // 6. Saturation
    let (r_sat, g_sat, b_sat) = if saturation != 1.0 {
        let (h, s, l) = rgb_to_hsl(r_con, g_con, b_con);
        let new_s = (s * saturation).clamp(0.0, 1.0);
        hsl_to_rgb(h, new_s, l)
    } else {
        (r_con, g_con, b_con)
    };

    // 7. Gamma correction
    let r_gamma = r_sat.clamp(0.0, 1.0).powf(1.0 / 2.2);
    let g_gamma = g_sat.clamp(0.0, 1.0).powf(1.0 / 2.2);
    let b_gamma = b_sat.clamp(0.0, 1.0).powf(1.0 / 2.2);

    // 8. Convert to u8
    (
        (r_gamma * 255.0) as u8,
        (g_gamma * 255.0) as u8,
        (b_gamma * 255.0) as u8,
    )
}

// --- HSL <-> RGB Conversion Helpers ---

fn rgb_to_hsl(r: f32, g: f32, b: f32) -> (f32, f32, f32) {
    let max = r.max(g.max(b));
    let min = r.min(g.min(b));
    let mut h = 0.0;
    let mut s;
    let l = (max + min) / 2.0;

    if (max - min).abs() < 1e-6 {
        s = 0.0;
    } else {
        let d = max - min;
        s = if l > 0.5 { d / (2.0 - max - min) } else { d / (max + min) };
        h = match max {
            _ if (max - r).abs() < 1e-6 => (g - b) / d + (if g < b { 6.0 } else { 0.0 }),
            _ if (max - g).abs() < 1e-6 => (b - r) / d + 2.0,
            _ => (r - g) / d + 4.0,
        };
        h /= 6.0;
    }
    (h, s, l)
}

fn hsl_to_rgb(h: f32, s: f32, l: f32) -> (f32, f32, f32) {
    if s == 0.0 { return (l, l, l); }
    
    fn hue_to_rgb(p: f32, q: f32, mut t: f32) -> f32 {
        if t < 0.0 { t += 1.0; }
        if t > 1.0 { t -= 1.0; }
        if t < 1.0/6.0 { return p + (q - p) * 6.0 * t; }
        if t < 1.0/2.0 { return q; }
        if t < 2.0/3.0 { return p + (q - p) * (2.0/3.0 - t) * 6.0; }
        p
    }

    let q = if l < 0.5 { l * (1.0 + s) } else { l + s - l * s };
    let p = 2.0 * l - q;
    (
        hue_to_rgb(p, q, h + 1.0/3.0),
        hue_to_rgb(p, q, h),
        hue_to_rgb(p, q, h - 1.0/3.0),
    )
}

// --- Demosaicing Algorithms ---

fn demosaic_pixel_optimized_linear(raw_data: &[u16], x: u32, y: u32, width: u32, height: u32, pattern: BayerPattern) -> (f32, f32, f32) {
    let x_i = x as i32;
    let y_i = y as i32;

    let get_raw = |px: i32, py: i32| -> f32 {
        let clamped_x = px.max(0).min(width as i32 - 1) as u32;
        let clamped_y = py.max(0).min(height as i32 - 1) as u32;
        raw_data[(clamped_y * width + clamped_x) as usize] as f32
    };

    let get_color_at = |px: i32, py: i32| -> char {
        let (is_red_row, is_red_col) = match pattern {
            BayerPattern::RGGB => (py % 2 == 0, px % 2 == 0),
            BayerPattern::BGGR => (py % 2 == 1, px % 2 == 1),
            BayerPattern::GRBG => (py % 2 == 0, px % 2 == 1),
            BayerPattern::GBRG => (py % 2 == 1, px % 2 == 0),
        };
        if is_red_row == is_red_col { if is_red_row { 'R' } else { 'B' } } else { 'G' }
    };

    match get_color_at(x_i, y_i) {
        'R' => {
            let r = get_raw(x_i, y_i);
            let b = (get_raw(x_i - 1, y_i - 1) + get_raw(x_i + 1, y_i - 1) + get_raw(x_i - 1, y_i + 1) + get_raw(x_i + 1, y_i + 1)) / 4.0;
            let g_n = get_raw(x_i, y_i - 1);
            let g_s = get_raw(x_i, y_i + 1);
            let g_w = get_raw(x_i - 1, y_i);
            let g_e = get_raw(x_i + 1, y_i);
            let grad_v = (g_n - g_s).abs();
            let grad_h = (g_w - g_e).abs();
            let g = if grad_v < grad_h { (g_n + g_s) / 2.0 } else if grad_h < grad_v { (g_w + g_e) / 2.0 } else { (g_n + g_s + g_w + g_e) / 4.0 };
            (r, g, b)
        }
        'B' => {
            let b = get_raw(x_i, y_i);
            let r = (get_raw(x_i - 1, y_i - 1) + get_raw(x_i + 1, y_i - 1) + get_raw(x_i - 1, y_i + 1) + get_raw(x_i + 1, y_i + 1)) / 4.0;
            let g_n = get_raw(x_i, y_i - 1);
            let g_s = get_raw(x_i, y_i + 1);
            let g_w = get_raw(x_i - 1, y_i);
            let g_e = get_raw(x_i + 1, y_i);
            let grad_v = (g_n - g_s).abs();
            let grad_h = (g_w - g_e).abs();
            let g = if grad_v < grad_h { (g_n + g_s) / 2.0 } else if grad_h < grad_v { (g_w + g_e) / 2.0 } else { (g_n + g_s + g_w + g_e) / 4.0 };
            (r, g, b)
        }
        'G' => {
            let g = get_raw(x_i, y_i);
            let (r, b) = if get_color_at(x_i + 1, y_i) == 'R' {
                ((get_raw(x_i - 1, y_i) + get_raw(x_i + 1, y_i)) / 2.0, (get_raw(x_i, y_i - 1) + get_raw(x_i, y_i + 1)) / 2.0)
            } else {
                ((get_raw(x_i, y_i - 1) + get_raw(x_i, y_i + 1)) / 2.0, (get_raw(x_i - 1, y_i) + get_raw(x_i + 1, y_i)) / 2.0)
            };
            (r, g, b)
        }
        _ => (0.0, 0.0, 0.0),
    }
}

#[allow(non_snake_case)]
fn demosaic_menon2007(cfa_data: &[u16], width: u32, height: u32, pattern: BayerPattern, use_refining_step: bool) -> Vec<f32> {
    let size = (width * height) as usize;
    let cfa: Vec<f32> = cfa_data.par_iter().map(|&p| p as f32).collect();

    let (R_m, G_m, B_m) = get_bayer_masks(width, height, pattern);

    let mut R: Vec<f32> = vec![0.0; size];
    let mut G: Vec<f32> = vec![0.0; size];
    let mut B: Vec<f32> = vec![0.0; size];

    R.par_iter_mut().zip_eq(G.par_iter_mut()).zip_eq(B.par_iter_mut()).enumerate()
        .for_each(|(i, ((r, g), b))| {
            if R_m[i] { *r = cfa[i]; }
            if G_m[i] { *g = cfa[i]; }
            if B_m[i] { *b = cfa[i]; }
        });

    let h_0 = [0.0, 0.5, 0.0, 0.5, 0.0];
    let h_1 = [-0.25, 0.0, 0.5, 0.0, -0.25];

    let G_H_conv: Vec<f32> = convolve_1d(&cfa, width, height, &h_0, Axis::Horizontal)
        .par_iter()
        .zip_eq(convolve_1d(&cfa, width, height, &h_1, Axis::Horizontal))
        .map(|(a, b)| a + b)
        .collect();

    let G_V_conv: Vec<f32> = convolve_1d(&cfa, width, height, &h_0, Axis::Vertical)
        .par_iter()
        .zip_eq(convolve_1d(&cfa, width, height, &h_1, Axis::Vertical))
        .map(|(a, b)| a + b)
        .collect();

    let G_H: Vec<f32> = G.par_iter().zip_eq(&G_m).zip_eq(&G_H_conv)
        .map(|((&g, &mask), &conv)| if mask { g } else { conv })
        .collect();
    let G_V: Vec<f32> = G.par_iter().zip_eq(&G_m).zip_eq(&G_V_conv)
        .map(|((&g, &mask), &conv)| if mask { g } else { conv })
        .collect();

    let mut C_H = vec![0.0; size];
    let mut C_V = vec![0.0; size];
    
    C_H.par_iter_mut().zip_eq(C_V.par_iter_mut()).enumerate()
        .for_each(|(i, (ch, cv))| {
            if R_m[i] {
                *ch = R[i] - G_H[i];
                *cv = R[i] - G_V[i];
            } else if B_m[i] {
                *ch = B[i] - G_H[i];
                *cv = B[i] - G_V[i];
            }
        });

    let D_H: Vec<f32> = (0..size).into_par_iter().map(|i| {
        let x = i % width as usize;
        let prev_idx = i.saturating_sub(if x >= 2 { 2 } else { x });
        (C_H[i] - C_H[prev_idx]).abs()
    }).collect();

    let D_V: Vec<f32> = (0..size).into_par_iter().map(|i| {
        let y = i / width as usize;
        let prev_idx = i.saturating_sub(if y >= 2 { 2 * width as usize } else { y * width as usize });
        (C_V[i] - C_V[prev_idx]).abs()
    }).collect();

    let d_H = convolve_box_filter_2d(&D_H, width, height, 5);
    let d_V = convolve_box_filter_2d(&D_V, width, height, 5);

    let M: Vec<bool> = d_H.par_iter().zip_eq(&d_V).map(|(h, v)| h <= v).collect();

    let mut G_final: Vec<f32> = G_H.par_iter().zip_eq(&G_V).zip_eq(&M)
        .map(|((&gh, &gv), &m)| if m { gh } else { gv })
        .collect();
    G_final.par_iter_mut().zip_eq(&G_m).zip_eq(&G)
        .for_each(|((g_final, &g_mask), &g_orig)| {
            if g_mask { *g_final = g_orig; }
        });

    let (R_r, _) = get_row_masks(width, height, &R_m, &B_m);
    let mut R_final = R.clone();
    let mut B_final = B.clone();

    let R_conv_at_G_h = convolve_1d(&R, width, height, &K_B, Axis::Horizontal);
    let G_conv_at_G_h = convolve_1d(&G_final, width, height, &K_B, Axis::Horizontal);
    let B_conv_at_G_h = convolve_1d(&B, width, height, &K_B, Axis::Horizontal);
    let R_conv_at_G_v = convolve_1d(&R, width, height, &K_B, Axis::Vertical);
    let G_conv_at_G_v = convolve_1d(&G_final, width, height, &K_B, Axis::Vertical);
    let B_conv_at_G_v = convolve_1d(&B, width, height, &K_B, Axis::Vertical);

    R_final.par_iter_mut().zip_eq(B_final.par_iter_mut()).enumerate().for_each(|(i, (rf, bf))| {
        if G_m[i] {
            if R_r[i] {
                *rf = G_final[i] + R_conv_at_G_h[i] - G_conv_at_G_h[i];
                *bf = G_final[i] + B_conv_at_G_v[i] - G_conv_at_G_v[i];
            } else {
                *rf = G_final[i] + R_conv_at_G_v[i] - G_conv_at_G_v[i];
                *bf = G_final[i] + B_conv_at_G_h[i] - G_conv_at_G_h[i];
            }
        }
    });

    let R_final_conv_h = convolve_1d(&R_final, width, height, &K_B, Axis::Horizontal);
    let B_final_conv_h = convolve_1d(&B_final, width, height, &K_B, Axis::Horizontal);
    let R_final_conv_v = convolve_1d(&R_final, width, height, &K_B, Axis::Vertical);
    let B_final_conv_v = convolve_1d(&B_final, width, height, &K_B, Axis::Vertical);

    R_final.par_iter_mut().zip_eq(B_final.par_iter_mut()).enumerate().for_each(|(i, (rf, bf))| {
        if B_m[i] {
            let rb_diff = if M[i] { R_final_conv_h[i] - B_final_conv_h[i] } else { R_final_conv_v[i] - B_final_conv_v[i] };
            *rf = *bf + rb_diff;
        } else if R_m[i] {
            let br_diff = if M[i] { B_final_conv_h[i] - R_final_conv_h[i] } else { B_final_conv_v[i] - R_final_conv_v[i] };
            *bf = *rf + br_diff;
        }
    });

    let (mut R_out, mut G_out, mut B_out) = (R_final, G_final, B_final);
    if use_refining_step {
        (R_out, G_out, B_out) = refining_step_menon2007(&R_out, &G_out, &B_out, &R_m, &G_m, &B_m, &M, width, height);
    }

    let mut rgb_f32_data = vec![0.0; size * 3];
    rgb_f32_data.par_chunks_mut(3).enumerate().for_each(|(i, chunk)| {
        chunk[0] = R_out[i];
        chunk[1] = G_out[i];
        chunk[2] = B_out[i];
    });
    rgb_f32_data
}

#[allow(non_snake_case)]
fn refining_step_menon2007(R_in: &[f32], G_in: &[f32], B_in: &[f32], R_m: &[bool], G_m: &[bool], B_m: &[bool], M: &[bool], width: u32, height: u32) -> (Vec<f32>, Vec<f32>, Vec<f32>) {
    let mut R = R_in.to_vec();
    let mut G = G_in.to_vec();
    let mut B = B_in.to_vec();
    let (R_r, _) = get_row_masks(width, height, R_m, B_m);
    let fir = [1.0 / 3.0, 1.0 / 3.0, 1.0 / 3.0];

    // Step 1: Refine G at R and B locations.
    let R_G_step1: Vec<f32> = R.par_iter().zip_eq(&G).map(|(r, g)| r - g).collect();
    let B_G_step1: Vec<f32> = B.par_iter().zip_eq(&G).map(|(b, g)| b - g).collect();
    let R_G_h_step1 = convolve_1d(&R_G_step1, width, height, &fir, Axis::Horizontal);
    let R_G_v_step1 = convolve_1d(&R_G_step1, width, height, &fir, Axis::Vertical);
    let B_G_h_step1 = convolve_1d(&B_G_step1, width, height, &fir, Axis::Horizontal);
    let B_G_v_step1 = convolve_1d(&B_G_step1, width, height, &fir, Axis::Vertical);
    G.par_iter_mut().enumerate().for_each(|(i, g)| {
        if R_m[i] { *g = R[i] - if M[i] { R_G_h_step1[i] } else { R_G_v_step1[i] }; }
        else if B_m[i] { *g = B[i] - if M[i] { B_G_h_step1[i] } else { B_G_v_step1[i] }; }
    });

    // Step 2: Refine R/B at G locations.
    let R_G_step2: Vec<f32> = R.par_iter().zip_eq(&G).map(|(r, g)| r - g).collect();
    let B_G_step2: Vec<f32> = B.par_iter().zip_eq(&G).map(|(b, g)| b - g).collect();
    let R_G_h_step2 = convolve_1d(&R_G_step2, width, height, &K_B, Axis::Horizontal);
    let R_G_v_step2 = convolve_1d(&R_G_step2, width, height, &K_B, Axis::Vertical);
    let B_G_h_step2 = convolve_1d(&B_G_step2, width, height, &K_B, Axis::Horizontal);
    let B_G_v_step2 = convolve_1d(&B_G_step2, width, height, &K_B, Axis::Vertical);
    R.par_iter_mut().zip_eq(B.par_iter_mut()).enumerate().for_each(|(i, (r, b))| {
        if G_m[i] {
            if R_r[i] {
                *r = G[i] + R_G_h_step2[i];
                *b = G[i] + B_G_v_step2[i];
            } else {
                *r = G[i] + R_G_v_step2[i];
                *b = G[i] + B_G_h_step2[i];
            }
        }
    });

    // Step 3: Refine R/B at B/R locations.
    let R_prev = R.clone();
    let B_prev = B.clone();
    
    let R_B: Vec<f32> = R_prev.par_iter().zip_eq(&B_prev).map(|(r, b)| r - b).collect();
    let R_B_h = convolve_1d(&R_B, width, height, &fir, Axis::Horizontal);
    let R_B_v = convolve_1d(&R_B, width, height, &fir, Axis::Vertical);

    R.par_iter_mut().zip_eq(B.par_iter_mut()).enumerate().for_each(|(i, (r, b))| {
        if B_m[i] { 
            *r = B_prev[i] + if M[i] { R_B_h[i] } else { R_B_v[i] }; 
        } else if R_m[i] { 
            *b = R_prev[i] - if M[i] { R_B_h[i] } else { R_B_v[i] }; 
        }
    });

    (R, G, B)
}

fn get_bayer_masks(width: u32, height: u32, pattern: BayerPattern) -> (Vec<bool>, Vec<bool>, Vec<bool>) {
    let size = (width * height) as usize;
    let mut r_mask = vec![false; size];
    let mut g_mask = vec![false; size];
    let mut b_mask = vec![false; size];

    let r_chunks = r_mask.par_chunks_mut(width as usize);
    let g_chunks = g_mask.par_chunks_mut(width as usize);
    let b_chunks = b_mask.par_chunks_mut(width as usize);

    r_chunks.zip_eq(g_chunks).zip_eq(b_chunks).enumerate().for_each(|(y, ((r_row, g_row), b_row))| {
        for x in 0..width as usize {
            let (row_even, col_even) = (y % 2 == 0, x % 2 == 0);
            let c = match pattern {
                BayerPattern::RGGB => if row_even { if col_even { 'R' } else { 'G' } } else { if col_even { 'G' } else { 'B' } },
                BayerPattern::BGGR => if row_even { if col_even { 'B' } else { 'G' } } else { if col_even { 'G' } else { 'R' } },
                BayerPattern::GRBG => if row_even { if col_even { 'G' } else { 'R' } } else { if col_even { 'B' } else { 'G' } },
                BayerPattern::GBRG => if row_even { if col_even { 'G' } else { 'B' } } else { if col_even { 'R' } else { 'G' } },
            };
            match c {
                'R' => r_row[x] = true,
                'G' => g_row[x] = true,
                'B' => b_row[x] = true,
                _ => {}
            }
        }
    });

    (r_mask, g_mask, b_mask)
}

fn get_row_masks(width: u32, height: u32, r_m: &[bool], b_m: &[bool]) -> (Vec<bool>, Vec<bool>) {
    let mut r_rows = vec![false; height as usize];
    let mut b_rows = vec![false; height as usize];
    for y in 0..height {
        if r_m[(y * width) as usize] || r_m[(y * width + 1).min(width * height - 1) as usize] {
            r_rows[y as usize] = true;
        }
        if b_m[(y * width) as usize] || b_m[(y * width + 1).min(width * height - 1) as usize] {
            b_rows[y as usize] = true;
        }
    }
    let mut r_r = vec![false; (width * height) as usize];
    let mut b_r = vec![false; (width * height) as usize];
    for y in 0..height {
        for x in 0..width {
            let idx = (y * width + x) as usize;
            if r_rows[y as usize] { r_r[idx] = true; }
            if b_rows[y as usize] { b_r[idx] = true; }
        }
    }
    (r_r, b_r)
}

fn convolve_1d(data: &[f32], width: u32, height: u32, kernel: &[f32], axis: Axis) -> Vec<f32> {
    let mut output = vec![0.0; data.len()];
    let k_len = kernel.len();
    let k_center = k_len / 2;

    output.par_chunks_mut(width as usize).enumerate().for_each(|(y, row_out)| {
        for x in 0..width as usize {
            let mut sum = 0.0;
            for k in 0..k_len {
                let offset = k as i32 - k_center as i32;
                let (px, py) = match axis {
                    Axis::Horizontal => (x as i32 + offset, y as i32),
                    Axis::Vertical => (x as i32, y as i32 + offset),
                };

                let mirror_x = if px < 0 { -px } else if px >= width as i32 { 2 * (width as i32 - 1) - px } else { px } as u32;
                let mirror_y = if py < 0 { -py } else if py >= height as i32 { 2 * (height as i32 - 1) - py } else { py } as u32;
                
                let idx = (mirror_y * width + mirror_x) as usize;
                sum += data[idx] * kernel[k];
            }
            row_out[x] = sum;
        }
    });
    output
}

fn convolve_box_filter_2d(data: &[f32], width: u32, height: u32, k_side: usize) -> Vec<f32> {
    let kernel_1d: Vec<f32> = vec![1.0; k_side];
    let horizontal_pass = convolve_1d(data, width, height, &kernel_1d, Axis::Horizontal);
    let vertical_pass = convolve_1d(&horizontal_pass, width, height, &kernel_1d, Axis::Vertical);
    
    vertical_pass
}