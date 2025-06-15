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
    // HSL
    hsl: array<HslColor, 8>,
    // Curves
    luma_curve: array<Point, 16>,
    red_curve: array<Point, 16>,
    green_curve: array<Point, 16>,
    blue_curve: array<Point, 16>,
    luma_curve_count: u32,
    red_curve_count: u32,
    green_curve_count: u32,
    blue_curve_count: u32,
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

fn get_hsl_influence(hue: f32, center_hue: f32, range_width: f32) -> f32 {
    let diff1 = abs(hue - center_hue);
    let diff2 = 360.0 - diff1;
    let distance = min(diff1, diff2);
    let normalized_distance = distance / (range_width * 0.5);
    return 1.0 - smoothstep(0.0, 1.0, normalized_distance);
}

fn apply_curve(val: f32, points: array<Point, 16>, count: u32) -> f32 {
    if (count < 2u) {
        return val;
    }

    let x = val * 255.0;
    if (x <= points[0].x) { 
        return clamp(points[0].y / 255.0, 0.0, 1.0); 
    }

    if (count >= 2u && x <= points[1].x) {
        let p1 = points[0]; let p2 = points[1];
        return interpolate_curve_segment(x, p1, p2);
    }
    if (count >= 3u && x <= points[2].x) {
        let p1 = points[1]; let p2 = points[2];
        return interpolate_curve_segment(x, p1, p2);
    }
    if (count >= 4u && x <= points[3].x) {
        let p1 = points[2]; let p2 = points[3];
        return interpolate_curve_segment(x, p1, p2);
    }
    if (count >= 5u && x <= points[4].x) {
        let p1 = points[3]; let p2 = points[4];
        return interpolate_curve_segment(x, p1, p2);
    }
    if (count >= 6u && x <= points[5].x) {
        let p1 = points[4]; let p2 = points[5];
        return interpolate_curve_segment(x, p1, p2);
    }
    if (count >= 7u && x <= points[6].x) {
        let p1 = points[5]; let p2 = points[6];
        return interpolate_curve_segment(x, p1, p2);
    }
    if (count >= 8u && x <= points[7].x) {
        let p1 = points[6]; let p2 = points[7];
        return interpolate_curve_segment(x, p1, p2);
    }
    if (count >= 9u && x <= points[8].x) {
        let p1 = points[7]; let p2 = points[8];
        return interpolate_curve_segment(x, p1, p2);
    }
    if (count >= 10u && x <= points[9].x) {
        let p1 = points[8]; let p2 = points[9];
        return interpolate_curve_segment(x, p1, p2);
    }
    if (count >= 11u && x <= points[10].x) {
        let p1 = points[9]; let p2 = points[10];
        return interpolate_curve_segment(x, p1, p2);
    }
    if (count >= 12u && x <= points[11].x) {
        let p1 = points[10]; let p2 = points[11];
        return interpolate_curve_segment(x, p1, p2);
    }
    if (count >= 13u && x <= points[12].x) {
        let p1 = points[11]; let p2 = points[12];
        return interpolate_curve_segment(x, p1, p2);
    }
    if (count >= 14u && x <= points[13].x) {
        let p1 = points[12]; let p2 = points[13];
        return interpolate_curve_segment(x, p1, p2);
    }
    if (count >= 15u && x <= points[14].x) {
        let p1 = points[13]; let p2 = points[14];
        return interpolate_curve_segment(x, p1, p2);
    }
    if (count >= 16u && x <= points[15].x) {
        let p1 = points[14]; let p2 = points[15];
        return interpolate_curve_segment(x, p1, p2);
    }

    if (count >= 16u) { return clamp(points[15].y / 255.0, 0.0, 1.0); }
    if (count >= 15u) { return clamp(points[14].y / 255.0, 0.0, 1.0); }
    if (count >= 14u) { return clamp(points[13].y / 255.0, 0.0, 1.0); }
    if (count >= 13u) { return clamp(points[12].y / 255.0, 0.0, 1.0); }
    if (count >= 12u) { return clamp(points[11].y / 255.0, 0.0, 1.0); }
    if (count >= 11u) { return clamp(points[10].y / 255.0, 0.0, 1.0); }
    if (count >= 10u) { return clamp(points[9].y / 255.0, 0.0, 1.0); }
    if (count >= 9u) { return clamp(points[8].y / 255.0, 0.0, 1.0); }
    if (count >= 8u) { return clamp(points[7].y / 255.0, 0.0, 1.0); }
    if (count >= 7u) { return clamp(points[6].y / 255.0, 0.0, 1.0); }
    if (count >= 6u) { return clamp(points[5].y / 255.0, 0.0, 1.0); }
    if (count >= 5u) { return clamp(points[4].y / 255.0, 0.0, 1.0); }
    if (count >= 4u) { return clamp(points[3].y / 255.0, 0.0, 1.0); }
    if (count >= 3u) { return clamp(points[2].y / 255.0, 0.0, 1.0); }
    return clamp(points[1].y / 255.0, 0.0, 1.0);
}

fn interpolate_curve_segment(x: f32, p1: Point, p2: Point) -> f32 {
    var result_y: f32;
    if (abs(p1.x - p2.x) < 0.001) {
        result_y = p1.y;
    } else {
        let t = (x - p1.x) / (p2.x - p1.x);
        result_y = mix(p1.y, p2.y, t);
    }
    return clamp(result_y / 255.0, 0.0, 1.0);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let pixel_coords = vec2<i32>(i32(id.x), i32(id.y));
    let dims = textureDimensions(input_texture);
    if (id.x >= dims.x || id.y >= dims.y) { return; }

    var color = textureLoad(input_texture, pixel_coords, 0);
    var rgb = color.rgb;

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

    let temp = adjustments.temperature;
    let tint = adjustments.tint;
    let wb_multiplier = vec3<f32>(1.0 + temp, 1.0 - tint, 1.0 - temp);
    rgb *= wb_multiplier;

    var hsv = rgb_to_hsv(rgb);

    if (hsv.y > 0.001) {
        let saturation_mask = 1.0 - smoothstep(0.2, 0.8, hsv.y);

        let skin_hue_center = 40.0;
        let hue_dist = min(abs(hsv.x - skin_hue_center), 360.0 - abs(hsv.x - skin_hue_center));
        let skin_protection = smoothstep(15.0, 40.0, hue_dist);

        let vibrance_effect = adjustments.vibrance * saturation_mask * skin_protection;

        let total_saturation_multiplier = 1.0 + adjustments.saturation + vibrance_effect;
        hsv.y *= total_saturation_multiplier;
    }

    hsv.y = clamp(hsv.y, 0.0, 1.0);

    if (hsv.y > 0.01) {
        var total_hue_shift: f32 = 0.0;
        var total_sat_adjust: f32 = 0.0;
        var total_lum_adjust: f32 = 0.0;
        var total_influence: f32 = 0.0;

        var influence = get_hsl_influence(hsv.x, 0.0, 80.0);
        if (influence > 0.001) { total_hue_shift += adjustments.hsl[0].hue * influence; total_sat_adjust += adjustments.hsl[0].saturation * influence; total_lum_adjust += adjustments.hsl[0].luminance * influence; total_influence += influence; }
        influence = get_hsl_influence(hsv.x, 30.0, 70.0);
        if (influence > 0.001) { total_hue_shift += adjustments.hsl[1].hue * influence; total_sat_adjust += adjustments.hsl[1].saturation * influence; total_lum_adjust += adjustments.hsl[1].luminance * influence; total_influence += influence; }
        influence = get_hsl_influence(hsv.x, 60.0, 70.0);
        if (influence > 0.001) { total_hue_shift += adjustments.hsl[2].hue * influence; total_sat_adjust += adjustments.hsl[2].saturation * influence; total_lum_adjust += adjustments.hsl[2].luminance * influence; total_influence += influence; }
        influence = get_hsl_influence(hsv.x, 120.0, 100.0);
        if (influence > 0.001) { total_hue_shift += adjustments.hsl[3].hue * influence; total_sat_adjust += adjustments.hsl[3].saturation * influence; total_lum_adjust += adjustments.hsl[3].luminance * influence; total_influence += influence; }
        influence = get_hsl_influence(hsv.x, 180.0, 80.0);
        if (influence > 0.001) { total_hue_shift += adjustments.hsl[4].hue * influence; total_sat_adjust += adjustments.hsl[4].saturation * influence; total_lum_adjust += adjustments.hsl[4].luminance * influence; total_influence += influence; }
        influence = get_hsl_influence(hsv.x, 240.0, 90.0);
        if (influence > 0.001) { total_hue_shift += adjustments.hsl[5].hue * influence; total_sat_adjust += adjustments.hsl[5].saturation * influence; total_lum_adjust += adjustments.hsl[5].luminance * influence; total_influence += influence; }
        influence = get_hsl_influence(hsv.x, 285.0, 80.0);
        if (influence > 0.001) { total_hue_shift += adjustments.hsl[6].hue * influence; total_sat_adjust += adjustments.hsl[6].saturation * influence; total_lum_adjust += adjustments.hsl[6].luminance * influence; total_influence += influence; }
        influence = get_hsl_influence(hsv.x, 330.0, 80.0);
        if (influence > 0.001) { total_hue_shift += adjustments.hsl[7].hue * influence; total_sat_adjust += adjustments.hsl[7].saturation * influence; total_lum_adjust += adjustments.hsl[7].luminance * influence; total_influence += influence; }

        if (total_influence > 0.001) {
            let norm_factor = 1.0 / total_influence;
            hsv.x = (hsv.x + total_hue_shift * norm_factor + 360.0) % 360.0;
            hsv.y = clamp(hsv.y * (1.0 + total_sat_adjust * norm_factor), 0.0, 1.0);
            hsv.z = clamp(hsv.z * (1.0 + total_lum_adjust * norm_factor), 0.0, 1.0);
        }
    }
    rgb = hsv_to_rgb(hsv);

    var luma_adjusted_rgb = vec3<f32>(
        apply_curve(rgb.r, adjustments.luma_curve, adjustments.luma_curve_count),
        apply_curve(rgb.g, adjustments.luma_curve, adjustments.luma_curve_count),
        apply_curve(rgb.b, adjustments.luma_curve, adjustments.luma_curve_count)
    );
    let final_rgb = vec3<f32>(
        apply_curve(luma_adjusted_rgb.r, adjustments.red_curve, adjustments.red_curve_count),
        apply_curve(luma_adjusted_rgb.g, adjustments.green_curve, adjustments.green_curve_count),
        apply_curve(luma_adjusted_rgb.b, adjustments.blue_curve, adjustments.blue_curve_count)
    );

    textureStore(output_texture, pixel_coords, clamp(vec4<f32>(final_rgb, color.a), vec4<f32>(0.0), vec4<f32>(1.0)));
}