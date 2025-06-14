// src-tauri/src/shader.wgsl

struct Point {
    x: f32,
    y: f32,
    _pad1: f32,
    _pad2: f32,
}

struct HslColor {
    hue: f32,
    saturation: f32,
    luminance: f32,
    _pad: f32,
}

struct Adjustments {
    // Group 1
    exposure: f32,
    contrast: f32,
    highlights: f32,
    shadows: f32,
    // Group 2
    whites: f32,
    blacks: f32,
    saturation: f32,
    temperature: f32,
    // Group 3
    tint: f32,
    vibrance: f32,
    _pad1: f32,
    _pad2: f32,
    // HSL and Curves
    hsl: array<HslColor, 8>,
    curve_points: array<Point, 16>,
    curve_points_count: u32,
    _p1: u32,
    _p2: u32,
    _p3: u32,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var output_texture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> adjustments: Adjustments;

fn rgb_to_hsv(c: vec3<f32>) -> vec3<f32> {
    let c_max = max(c.r, max(c.g, c.b));
    let c_min = min(c.r, min(c.g, c.b));
    let delta = c_max - c_min;
    var h: f32 = 0.0;
    if (delta > 0.0) {
        if (c_max == c.r) { h = 60.0 * (((c.g - c.b) / delta) % 6.0); }
        else if (c_max == c.g) { h = 60.0 * (((c.b - c.r) / delta) + 2.0); }
        else { h = 60.0 * (((c.r - c.g) / delta) + 4.0); }
    }
    if (h < 0.0) { h += 360.0; }
    let s = select(0.0, delta / c_max, c_max > 0.0);
    return vec3<f32>(h, s, c_max);
}

fn hsv_to_rgb(c: vec3<f32>) -> vec3<f32> {
    let h = c.x; let s = c.y; let v = c.z;
    let C = v * s;
    let X = C * (1.0 - abs((h / 60.0) % 2.0 - 1.0));
    let m = v - C;
    var rgb_prime: vec3<f32>;
    if (h < 60.0) { rgb_prime = vec3<f32>(C, X, 0.0); }
    else if (h < 120.0) { rgb_prime = vec3<f32>(X, C, 0.0); }
    else if (h < 180.0) { rgb_prime = vec3<f32>(0.0, C, X); }
    else if (h < 240.0) { rgb_prime = vec3<f32>(0.0, X, C); }
    else if (h < 300.0) { rgb_prime = vec3<f32>(X, 0.0, C); }
    else { rgb_prime = vec3<f32>(C, 0.0, X); }
    return rgb_prime + vec3<f32>(m, m, m);
}

fn interpolate(x: f32, p1: Point, p2: Point) -> f32 {
    var result_y: f32;
    if (abs(p1.x - p2.x) < 0.001) {
        result_y = p1.y;
    } else {
        let t = (x - p1.x) / (p2.x - p1.x);
        result_y = mix(p1.y, p2.y, t);
    }
    return clamp(result_y / 255.0, 0.0, 1.0);
}

fn apply_curve(val: f32) -> f32 {
    let count = adjustments.curve_points_count;
    if (count < 2u) {
        if (count == 1u) { return clamp(adjustments.curve_points[0].y / 255.0, 0.0, 1.0); }
        return val;
    }

    let x = val * 255.0;
    if (x <= adjustments.curve_points[0].x) { 
        return clamp(adjustments.curve_points[0].y / 255.0, 0.0, 1.0); 
    }

    for (var i: u32 = 0u; i < 15u; i = i + 1u) {
        if (i >= count - 1u) { break; }
        if (x <= adjustments.curve_points[i + 1u].x) {
            return interpolate(x, adjustments.curve_points[i], adjustments.curve_points[i + 1u]);
        }
    }

    return clamp(adjustments.curve_points[count - 1u].y / 255.0, 0.0, 1.0);
}

// Improved Lightroom-style HSL color range calculation
fn get_hsl_influence(hue: f32, center_hue: f32, range_width: f32) -> f32 {
    // Calculate shortest distance on the color wheel
    let diff1 = abs(hue - center_hue);
    let diff2 = 360.0 - diff1;
    let distance = min(diff1, diff2);
    
    // Create smooth falloff with wider ranges for better coverage
    let normalized_distance = distance / (range_width * 0.5);
    
    // Use smooth step for gradual transitions
    return 1.0 - smoothstep(0.0, 1.0, normalized_distance);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let pixel_coords = vec2<i32>(i32(id.x), i32(id.y));
    let dims = textureDimensions(input_texture);
    if (id.x >= dims.x || id.y >= dims.y) { return; }

    var color = textureLoad(input_texture, pixel_coords, 0);
    var rgb = color.rgb;

    // 1. Basic tonal adjustments (unchanged)
    rgb += vec3<f32>(adjustments.exposure * 0.5);

    let black_point = -adjustments.blacks;
    let white_point = 1.0 - adjustments.whites;
    rgb = (rgb - vec3<f32>(black_point)) / max(white_point - black_point, 0.001);

    let luma = dot(rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
    let shadow_mix = 1.0 - smoothstep(0.0, 0.5, luma);
    let highlight_mix = smoothstep(0.5, 1.0, luma);
    rgb += vec3<f32>(adjustments.shadows * shadow_mix);
    rgb += vec3<f32>(adjustments.highlights * highlight_mix);

    rgb = 0.5 + (rgb - 0.5) * (1.0 + adjustments.contrast);
    rgb = clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0));

    // 2. White Balance (unchanged)
    rgb.r += adjustments.temperature;
    rgb.b -= adjustments.temperature;
    rgb.g -= adjustments.tint;

    // 3. Convert to HSV for color work
    var hsv = rgb_to_hsv(rgb);

    // 4. Vibrance (unchanged)
    let vibrance_boost = adjustments.vibrance * (1.0 - smoothstep(0.1, 0.7, hsv.y));
    hsv.y = clamp(hsv.y + vibrance_boost, 0.0, 1.0);

    // 5. Global Saturation (unchanged)
    hsv.y = clamp(hsv.y * (1.0 + adjustments.saturation), 0.0, 1.0);

    // 6. Improved HSL Color Mixer with Lightroom-style ranges
    if (hsv.y > 0.01) {
        var total_hue_shift: f32 = 0.0;
        var total_sat_adjust: f32 = 0.0;
        var total_lum_adjust: f32 = 0.0;
        var total_influence: f32 = 0.0;

        // Define color centers and ranges matching Lightroom's behavior
        // Reds: centered at 0° with wider range to catch magentas and oranges
        var influence = get_hsl_influence(hsv.x, 0.0, 80.0);
        if (influence > 0.001) {
            total_hue_shift += adjustments.hsl[0].hue * influence;
            total_sat_adjust += adjustments.hsl[0].saturation * influence;
            total_lum_adjust += adjustments.hsl[0].luminance * influence;
            total_influence += influence;
        }

        // Oranges: centered at 30° with good overlap with reds and yellows
        influence = get_hsl_influence(hsv.x, 30.0, 70.0);
        if (influence > 0.001) {
            total_hue_shift += adjustments.hsl[1].hue * influence;
            total_sat_adjust += adjustments.hsl[1].saturation * influence;
            total_lum_adjust += adjustments.hsl[1].luminance * influence;
            total_influence += influence;
        }

        // Yellows: centered at 60° with overlap to oranges and greens
        influence = get_hsl_influence(hsv.x, 60.0, 70.0);
        if (influence > 0.001) {
            total_hue_shift += adjustments.hsl[2].hue * influence;
            total_sat_adjust += adjustments.hsl[2].saturation * influence;
            total_lum_adjust += adjustments.hsl[2].luminance * influence;
            total_influence += influence;
        }

        // Greens: centered at 120° with wider range for nature photos
        influence = get_hsl_influence(hsv.x, 120.0, 100.0);
        if (influence > 0.001) {
            total_hue_shift += adjustments.hsl[3].hue * influence;
            total_sat_adjust += adjustments.hsl[3].saturation * influence;
            total_lum_adjust += adjustments.hsl[3].luminance * influence;
            total_influence += influence;
        }

        // Aquas/Cyans: centered at 180° with good coverage of blue-greens
        influence = get_hsl_influence(hsv.x, 180.0, 80.0);
        if (influence > 0.001) {
            total_hue_shift += adjustments.hsl[4].hue * influence;
            total_sat_adjust += adjustments.hsl[4].saturation * influence;
            total_lum_adjust += adjustments.hsl[4].luminance * influence;
            total_influence += influence;
        }

        // Blues: centered at 240° with wider range for skies and water
        influence = get_hsl_influence(hsv.x, 240.0, 90.0);
        if (influence > 0.001) {
            total_hue_shift += adjustments.hsl[5].hue * influence;
            total_sat_adjust += adjustments.hsl[5].saturation * influence;
            total_lum_adjust += adjustments.hsl[5].luminance * influence;
            total_influence += influence;
        }

        // Purples: centered at 285° with good coverage of blue-purples
        influence = get_hsl_influence(hsv.x, 285.0, 80.0);
        if (influence > 0.001) {
            total_hue_shift += adjustments.hsl[6].hue * influence;
            total_sat_adjust += adjustments.hsl[6].saturation * influence;
            total_lum_adjust += adjustments.hsl[6].luminance * influence;
            total_influence += influence;
        }

        // Magentas: centered at 330° with overlap to purples and reds
        influence = get_hsl_influence(hsv.x, 330.0, 80.0);
        if (influence > 0.001) {
            total_hue_shift += adjustments.hsl[7].hue * influence;
            total_sat_adjust += adjustments.hsl[7].saturation * influence;
            total_lum_adjust += adjustments.hsl[7].luminance * influence;
            total_influence += influence;
        }

        // Apply adjustments with proper normalization
        if (total_influence > 0.001) {
            // Normalize by total influence to prevent over-application in overlap zones
            let norm_factor = 1.0 / total_influence;
            hsv.x = (hsv.x + total_hue_shift * norm_factor + 360.0) % 360.0;
            hsv.y = clamp(hsv.y * (1.0 + total_sat_adjust * norm_factor), 0.0, 1.0);
            hsv.z = clamp(hsv.z * (1.0 + total_lum_adjust * norm_factor), 0.0, 1.0);
        }
    }

    // 7. Convert back to RGB
    rgb = hsv_to_rgb(hsv);
    color = vec4<f32>(rgb, color.a);

    // 8. Apply RGB Curve (unchanged)
    if (adjustments.curve_points_count > 1u) {
        let r = apply_curve(color.r);
        let g = apply_curve(color.g);
        let b = apply_curve(color.b);
        color = vec4<f32>(r, g, b, color.a);
    }

    // 9. Final output
    textureStore(output_texture, pixel_coords, clamp(color, vec4<f32>(0.0), vec4<f32>(1.0)));
}