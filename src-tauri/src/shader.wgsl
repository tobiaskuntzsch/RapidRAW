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

struct GlobalAdjustments {
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
    
    sharpness: f32,
    luma_noise_reduction: f32,
    color_noise_reduction: f32,
    clarity: f32,
    dehaze: f32,
    structure: f32,
    vignette_amount: f32,
    vignette_midpoint: f32,
    vignette_roundness: f32,
    vignette_feather: f32,
    grain_amount: f32,
    grain_size: f32,
    grain_roughness: f32,
    _pad1: f32,

    hsl: array<HslColor, 8>,
    luma_curve: array<Point, 16>,
    red_curve: array<Point, 16>,
    green_curve: array<Point, 16>,
    blue_curve: array<Point, 16>,
    luma_curve_count: u32,
    red_curve_count: u32,
    green_curve_count: u32,
    blue_curve_count: u32,
}

struct Mask {
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

struct AllAdjustments {
    global: GlobalAdjustments,
    masks: array<Mask, 16>,
    mask_count: u32,
    crop_x: u32,
    crop_y: u32,
    preview_scale: f32,
    tile_offset_x: u32,
    tile_offset_y: u32,
    _pad1: u32,
    _pad2: u32,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var output_texture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> adjustments: AllAdjustments;

// --- Color Space Conversion ---
fn srgb_to_linear(c: vec3<f32>) -> vec3<f32> {
    let cutoff = vec3<f32>(0.04045);
    let a = vec3<f32>(0.055);
    let higher = pow((c + a) / (1.0 + a), vec3<f32>(2.4));
    let lower = c / 12.92;
    return select(higher, lower, c <= cutoff);
}

fn linear_to_srgb(c: vec3<f32>) -> vec3<f32> {
    let c_clamped = clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));
    let cutoff = vec3<f32>(0.0031308);
    let a = vec3<f32>(0.055);
    let higher = (1.0 + a) * pow(c_clamped, vec3<f32>(1.0 / 2.4)) - a;
    let lower = c_clamped * 12.92;
    return select(higher, lower, c_clamped <= cutoff);
}

// --- HSV/RGB Conversion ---
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

fn apply_curve(val: f32, points: array<Point, 16>, count: u32) -> f32 {
    if (count < 2u) { return val; }
    let x = val * 255.0;
    if (x <= points[0].x) { return clamp(points[0].y / 255.0, 0.0, 1.0); }
    if (count >= 2u && x <= points[1].x) { return interpolate_curve_segment(x, points[0], points[1]); }
    if (count >= 3u && x <= points[2].x) { return interpolate_curve_segment(x, points[1], points[2]); }
    if (count >= 4u && x <= points[3].x) { return interpolate_curve_segment(x, points[2], points[3]); }
    if (count >= 5u && x <= points[4].x) { return interpolate_curve_segment(x, points[3], points[4]); }
    if (count >= 6u && x <= points[5].x) { return interpolate_curve_segment(x, points[4], points[5]); }
    if (count >= 7u && x <= points[6].x) { return interpolate_curve_segment(x, points[5], points[6]); }
    if (count >= 8u && x <= points[7].x) { return interpolate_curve_segment(x, points[6], points[7]); }
    if (count >= 9u && x <= points[8].x) { return interpolate_curve_segment(x, points[7], points[8]); }
    if (count >= 10u && x <= points[9].x) { return interpolate_curve_segment(x, points[8], points[9]); }
    if (count >= 11u && x <= points[10].x) { return interpolate_curve_segment(x, points[9], points[10]); }
    if (count >= 12u && x <= points[11].x) { return interpolate_curve_segment(x, points[10], points[11]); }
    if (count >= 13u && x <= points[12].x) { return interpolate_curve_segment(x, points[11], points[12]); }
    if (count >= 14u && x <= points[13].x) { return interpolate_curve_segment(x, points[12], points[13]); }
    if (count >= 15u && x <= points[14].x) { return interpolate_curve_segment(x, points[13], points[14]); }
    if (count >= 16u && x <= points[15].x) { return interpolate_curve_segment(x, points[14], points[15]); }
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

fn apply_basic_adjustments(color: vec3<f32>, exp: f32, con: f32, hi: f32, sh: f32, wh: f32, bl: f32, sat: f32, temp: f32, tnt: f32, vib: f32) -> vec3<f32> {
    var rgb = color;
    rgb *= pow(2.0, exp);
    let black_point = bl;
    let white_point = 1.0 + wh;
    rgb = (rgb - black_point) / max(white_point - black_point, 0.001);
    let luma = dot(rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
    let shadow_mix = 1.0 - smoothstep(0.0, 0.5, luma);
    let highlight_mix = smoothstep(0.5, 1.0, luma);
    rgb += sh * shadow_mix;
    rgb += hi * highlight_mix;
    rgb = 0.5 + (rgb - 0.5) * (1.0 + con);
    let wb_multiplier = vec3<f32>(1.0 + temp + tnt, 1.0, 1.0 - temp + tnt);
    rgb *= wb_multiplier;
    var hsv = rgb_to_hsv(rgb);
    if (hsv.y > 0.001) {
        let saturation_mask = 1.0 - smoothstep(0.2, 0.8, hsv.y);
        let skin_hue_center = 40.0;
        let hue_dist = min(abs(hsv.x - skin_hue_center), 360.0 - abs(hsv.x - skin_hue_center));
        let skin_protection = smoothstep(15.0, 40.0, hue_dist);
        let vibrance_effect = vib * saturation_mask * skin_protection;
        let total_saturation_multiplier = 1.0 + sat + vibrance_effect;
        hsv.y *= total_saturation_multiplier;
    }
    hsv.y = clamp(hsv.y, 0.0, 1.0);
    return hsv_to_rgb(hsv);
}

fn get_radial_mask_influence(pixel_coords: vec2<f32>, mask: Mask) -> f32 {
    let dx = pixel_coords.x - mask.center_x;
    let dy = pixel_coords.y - mask.center_y;
    let cos_rot = cos(-mask.rotation);
    let sin_rot = sin(-mask.rotation);
    let rot_dx = dx * cos_rot - dy * sin_rot;
    let rot_dy = dx * sin_rot + dy * cos_rot;
    let dist_x = rot_dx / max(mask.radius_x, 0.001);
    let dist_y = rot_dy / max(mask.radius_y, 0.001);
    let dist = sqrt(dist_x * dist_x + dist_y * dist_y);
    return 1.0 - smoothstep(1.0 - mask.feather, 1.0, dist);
}

fn get_linear_mask_influence(pixel_coords: vec2<f32>, mask: Mask) -> f32 {
    let start_point = vec2<f32>(mask.start_x, mask.start_y);
    let end_point = vec2<f32>(mask.end_x, mask.end_y);
    let gradient_vec = end_point - start_point;
    let len_sq = dot(gradient_vec, gradient_vec);
    if (len_sq < 0.001) { return 0.0; }
    let pixel_vec = pixel_coords - start_point;
    let t = dot(pixel_vec, gradient_vec) / len_sq;
    let half_feather = mask.feather * 0.5;
    return smoothstep(0.0 - half_feather, 0.0 + half_feather, t) - smoothstep(1.0 - half_feather, 1.0 + half_feather, t);
}

fn rand(co: vec2<f32>) -> f32 {
    return fract(sin(dot(co.xy, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}

fn get_luma(c: vec3<f32>) -> f32 {
    return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
}

// Fixed clarity/structure implementation - working in sRGB space for proper results
fn apply_local_contrast(processed_color: vec3<f32>, coords: vec2<i32>, radius: i32, amount: f32) -> vec3<f32> {
    if (amount == 0.0) { return processed_color; }

    let max_coords = vec2<i32>(textureDimensions(input_texture) - 1u);
    
    // Convert to sRGB for the blur operation - this is key!
    let processed_srgb = linear_to_srgb(processed_color);
    
    // Calculate blur parameters
    let blur_range = radius;
    let sample_step = max(1, blur_range / 8);
    
    var blurred_srgb = vec3<f32>(0.0);
    var total_weight = 0.0;
    
    // Proper Gaussian blur in sRGB space
    let sigma = f32(blur_range) * 0.4;
    let sigma_sq = sigma * sigma;
    
    for (var y = -blur_range; y <= blur_range; y += sample_step) {
        for (var x = -blur_range; x <= blur_range; x += sample_step) {
            let offset = vec2<i32>(x, y);
            let sample_coords = clamp(coords + offset, vec2<i32>(0), max_coords);
            let sample_srgb = textureLoad(input_texture, sample_coords, 0).rgb;
            // Keep in sRGB space for blur
            
            let dist_sq = f32(x * x + y * y);
            let weight = exp(-dist_sq / (2.0 * sigma_sq));
            
            blurred_srgb += sample_srgb * weight;
            total_weight += weight;
        }
    }
    
    if (total_weight > 0.0) {
        blurred_srgb /= total_weight;
    } else {
        blurred_srgb = processed_srgb;
    }
    
    // Calculate detail in sRGB space
    let detail_srgb = processed_srgb - blurred_srgb;
    
    // Create midtone mask using sRGB luminance
    let processed_luma_srgb = dot(processed_srgb, vec3<f32>(0.299, 0.587, 0.114));
    let shadow_protection = smoothstep(0.0, 0.25, processed_luma_srgb);
    let highlight_protection = 1.0 - smoothstep(0.75, 1.0, processed_luma_srgb);
    let midtone_mask = shadow_protection * highlight_protection;
    
    // Apply the effect in sRGB space
    var result_srgb: vec3<f32>;
    
    if (amount > 0.0) {
        // Positive: enhance detail (sharpening)
        let enhanced_detail = detail_srgb * amount * midtone_mask;
        result_srgb = processed_srgb + enhanced_detail;
    } else {
        // Negative: reduce detail (clarity/structure smoothing)
        let smoothing_amount = abs(amount) * midtone_mask;
        result_srgb = mix(processed_srgb, blurred_srgb, smoothing_amount);
    }
    
    // Clamp in sRGB space and convert back to linear
    result_srgb = clamp(result_srgb, vec3<f32>(0.0), vec3<f32>(1.0));
    return srgb_to_linear(result_srgb);
}

fn estimate_atmospheric_light(color: vec3<f32>) -> vec3<f32> {
    // Estimate the atmospheric light color (what would be pure white in haze)
    // In a real implementation, this would analyze the brightest pixels in the image
    // For shader efficiency, we use a reasonable approximation
    let brightness = get_luma(color);
    
    // Atmospheric light tends to be bluish-white
    let base_atmospheric = vec3<f32>(0.95, 0.96, 1.0);
    
    // Adjust based on the image's color temperature
    // Warmer images have more yellow/orange haze, cooler have more blue
    let color_temp_factor = (color.r + color.g * 0.5) / max(color.b, 0.001);
    let temp_adjustment = vec3<f32>(
        1.0 + (color_temp_factor - 1.0) * 0.3,
        1.0 + (color_temp_factor - 1.0) * 0.1,
        1.0
    );
    
    return normalize(base_atmospheric * temp_adjustment) * 0.9;
}

fn estimate_transmission_map(color: vec3<f32>, atmospheric_light: vec3<f32>, coords: vec2<i32>) -> f32 {
    // Calculate local transmission based on dark channel prior
    // and local contrast analysis
    
    let max_coords = vec2<i32>(textureDimensions(input_texture) - 1u);
    
    // Calculate dark channel in a local neighborhood
    var min_channel = 1.0;
    let patch_size = 8; // Size of local patch for dark channel
    
    for (var y = -patch_size; y <= patch_size; y += 2) {
        for (var x = -patch_size; x <= patch_size; x += 2) {
            let offset = vec2<i32>(x, y);
            let sample_coords = clamp(coords + offset, vec2<i32>(0), max_coords);
            let sample_srgb = textureLoad(input_texture, sample_coords, 0).rgb;
            let sample_linear = srgb_to_linear(sample_srgb);
            
            // Normalize by atmospheric light to get transmission estimate
            let normalized = sample_linear / max(atmospheric_light, vec3<f32>(0.001));
            let local_min = min(normalized.r, min(normalized.g, normalized.b));
            min_channel = min(min_channel, local_min);
        }
    }
    
    // Dark channel prior: transmission = 1 - omega * min_channel
    let omega = 0.95; // Typically 0.95 for outdoor scenes
    let raw_transmission = 1.0 - omega * min_channel;
    
    // Refine transmission using local contrast
    let local_contrast = calculate_local_contrast(color, coords);
    let contrast_factor = smoothstep(0.02, 0.15, local_contrast);
    
    // Low contrast areas are more likely to be hazy
    let haze_probability = 1.0 - contrast_factor;
    let refined_transmission = mix(raw_transmission, raw_transmission * 0.5, haze_probability);
    
    // Keep some minimum transmission to avoid over-correction
    return clamp(refined_transmission, 0.1, 1.0);
}

fn calculate_local_contrast(color: vec3<f32>, coords: vec2<i32>) -> f32 {
    // Calculate local standard deviation as a measure of contrast
    let max_coords = vec2<i32>(textureDimensions(input_texture) - 1u);
    
    var sum_luma = 0.0;
    var sum_luma_sq = 0.0;
    var count = 0.0;
    let radius = 4;
    
    for (var y = -radius; y <= radius; y += 1) {
        for (var x = -radius; x <= radius; x += 1) {
            let offset = vec2<i32>(x, y);
            let sample_coords = clamp(coords + offset, vec2<i32>(0), max_coords);
            let sample_srgb = textureLoad(input_texture, sample_coords, 0).rgb;
            let sample_linear = srgb_to_linear(sample_srgb);
            let luma = get_luma(sample_linear);
            
            sum_luma += luma;
            sum_luma_sq += luma * luma;
            count += 1.0;
        }
    }
    
    let mean_luma = sum_luma / count;
    let variance = (sum_luma_sq / count) - (mean_luma * mean_luma);
    return sqrt(max(variance, 0.0));
}

fn apply_guided_filter(transmission: f32, color: vec3<f32>, coords: vec2<i32>) -> f32 {
    // Simplified guided filter to smooth the transmission map
    // This prevents halos around edges
    
    let max_coords = vec2<i32>(textureDimensions(input_texture) - 1u);
    let guide_luma = get_luma(color);
    
    var sum_transmission = 0.0;
    var sum_weight = 0.0;
    let radius = 3;
    let epsilon = 0.01; // Regularization parameter
    
    for (var y = -radius; y <= radius; y += 1) {
        for (var x = -radius; x <= radius; x += 1) {
            let offset = vec2<i32>(x, y);
            let sample_coords = clamp(coords + offset, vec2<i32>(0), max_coords);
            let sample_srgb = textureLoad(input_texture, sample_coords, 0).rgb;
            let sample_linear = srgb_to_linear(sample_srgb);
            let sample_luma = get_luma(sample_linear);
            
            // Weight based on similarity to guide image
            let luma_diff = abs(sample_luma - guide_luma);
            let weight = exp(-luma_diff * luma_diff / (2.0 * epsilon));
            
            // We'd need to calculate transmission for each sample point
            // For efficiency, we'll use a simplified approach
            let dist = sqrt(f32(x * x + y * y));
            let spatial_weight = exp(-dist * dist / 8.0);
            let final_weight = weight * spatial_weight;
            
            sum_transmission += transmission * final_weight;
            sum_weight += final_weight;
        }
    }
    
    return select(transmission, sum_transmission / sum_weight, sum_weight > 0.0);
}

fn apply_advanced_dehaze(color: vec3<f32>, coords: vec2<i32>, amount: f32) -> vec3<f32> {
    if (amount == 0.0) { return color; }

    let atmospheric_light = estimate_atmospheric_light(color);

    let raw_transmission = estimate_transmission_map(color, atmospheric_light, coords);

    let smooth_transmission = apply_guided_filter(raw_transmission, color, coords);

    let t0 = 0.1;
    let effective_transmission = max(smooth_transmission, t0);
    let recovered = (color - atmospheric_light) / effective_transmission + atmospheric_light;
    var dehazed = mix(color, recovered, abs(amount));

    if (amount != 0.0) {
        let enhancement_strength = abs(amount) * 0.5;

        let local_contrast = calculate_local_contrast(dehazed, coords);
        let contrast_boost = 1.0 + enhancement_strength * smoothstep(0.01, 0.1, local_contrast);
        let luma = get_luma(dehazed);
        let enhanced_luma = 0.5 + (luma - 0.5) * contrast_boost;
        let luma_multiplier = select(1.0, enhanced_luma / max(luma, 0.001), luma > 0.001);
        dehazed *= luma_multiplier;

        let saturation_boost = enhancement_strength * (1.0 - smooth_transmission);
        var hsv = rgb_to_hsv(dehazed);
        hsv.y *= (1.0 + saturation_boost * 0.3);
        hsv.y = clamp(hsv.y, 0.0, 1.0);
        dehazed = hsv_to_rgb(hsv);

        let warmth_adjustment = vec3<f32>(
            1.0 + enhancement_strength * 0.05,
            1.0,
            1.0 - enhancement_strength * 0.05
        );
        dehazed *= warmth_adjustment;
    }

    if (amount < 0.0) {
        let haze_strength = abs(amount);
        let hazed = mix(dehazed, atmospheric_light, haze_strength * 0.3);
        let reduced_contrast = 0.5 + (hazed - 0.5) * (1.0 - haze_strength * 0.4);
        
        dehazed = reduced_contrast;
    }
    
    return clamp(dehazed, vec3<f32>(0.0), vec3<f32>(1.0));
}

fn apply_dehaze_fast(color: vec3<f32>, coords: vec2<i32>, amount: f32) -> vec3<f32> {
    if (amount == 0.0) { return color; }
    
    let max_coords = vec2<i32>(textureDimensions(input_texture) - 1u);

    let atmospheric_light = vec3<f32>(0.9, 0.92, 0.95);

    var local_min = 1.0;
    for (var y = -3; y <= 3; y += 2) {
        for (var x = -3; x <= 3; x += 2) {
            let offset = vec2<i32>(x, y);
            let sample_coords = clamp(coords + offset, vec2<i32>(0), max_coords);
            let sample_srgb = textureLoad(input_texture, sample_coords, 0).rgb;
            let sample_linear = srgb_to_linear(sample_srgb);
            let normalized = sample_linear / atmospheric_light;
            local_min = min(local_min, min(normalized.r, min(normalized.g, normalized.b)));
        }
    }
    
    let transmission = clamp(1.0 - 0.9 * local_min, 0.15, 1.0);
    let recovered = (color - atmospheric_light) / transmission + atmospheric_light;
    var result = mix(color, recovered, abs(amount));

    if (amount > 0.0) {
        let luma = get_luma(result);
        result = 0.5 + (result - 0.5) * (1.0 + amount * 0.2);
        
        var hsv = rgb_to_hsv(result);
        hsv.y *= (1.0 + amount * 0.15);
        hsv.y = clamp(hsv.y, 0.0, 1.0);
        result = hsv_to_rgb(hsv);
    } else {
        result = mix(result, atmospheric_light, abs(amount) * 0.25);
        result = 0.5 + (result - 0.5) * (1.0 - abs(amount) * 0.3);
    }
    
    return clamp(result, vec3<f32>(0.0), vec3<f32>(1.0));
}

fn apply_noise_reduction(color: vec3<f32>, coords: vec2<i32>, luma_amount: f32, color_amount: f32) -> vec3<f32> {
    if (luma_amount == 0.0 && color_amount == 0.0) { return color; }
    var accum_color = vec3<f32>(0.0);
    var total_weight = 0.0;
    let center_luma = get_luma(color);
    let max_coords = vec2<i32>(textureDimensions(input_texture) - 1u);

    for (var y = -1; y <= 1; y = y + 1) {
        for (var x = -1; x <= 1; x = x + 1) {
            let offset = vec2<i32>(x, y);
            let sample_color_srgb = textureLoad(input_texture, clamp(coords + offset, vec2<i32>(0), max_coords), 0).rgb;
            let sample_color = srgb_to_linear(sample_color_srgb);
            let luma_diff = abs(get_luma(sample_color) - center_luma);
            let color_diff = distance(sample_color.rg, color.rg) + distance(sample_color.gb, color.gb);
            let luma_weight = 1.0 - smoothstep(0.0, 0.1, luma_diff / max(luma_amount, 0.001));
            let color_weight = 1.0 - smoothstep(0.0, 0.2, color_diff / max(color_amount, 0.001));
            let weight = luma_weight * color_weight;
            accum_color += sample_color * weight;
            total_weight += weight;
        }
    }
    if (total_weight > 0.0) { return accum_color / total_weight; }
    return color;
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let pixel_coords_i = vec2<i32>(i32(id.x), i32(id.y));
    let dims = textureDimensions(input_texture);
    if (id.x >= dims.x || id.y >= dims.y) { return; }

    let local_coords = vec2<f32>(f32(id.x), f32(id.y));
    let tile_offset = vec2<f32>(f32(adjustments.tile_offset_x), f32(adjustments.tile_offset_y));
    let crop_offset = vec2<f32>(f32(adjustments.crop_x), f32(adjustments.crop_y));
    let inv_scale = 1.0 / max(adjustments.preview_scale, 0.001);
    let preview_coords = local_coords + tile_offset;
    let cropped_coords = preview_coords * inv_scale;
    let original_pixel_coords = cropped_coords + crop_offset;
    let uv = (preview_coords + 0.5) / vec2<f32>(dims);

    var color = textureLoad(input_texture, pixel_coords_i, 0);
    var processed_rgb = srgb_to_linear(color.rgb);

    // 1. Noise Reduction
    processed_rgb = apply_noise_reduction(processed_rgb, pixel_coords_i, adjustments.global.luma_noise_reduction, adjustments.global.color_noise_reduction);
    // 2. Dehaze
    processed_rgb = apply_dehaze_fast(processed_rgb, pixel_coords_i, adjustments.global.dehaze);
    // 3. Basic Adjustments
    processed_rgb = apply_basic_adjustments(processed_rgb, adjustments.global.exposure, adjustments.global.contrast, adjustments.global.highlights, adjustments.global.shadows, adjustments.global.whites, adjustments.global.blacks, adjustments.global.saturation, adjustments.global.temperature, adjustments.global.tint, adjustments.global.vibrance);
    
    // 4. Detail/Clarity/Structure
    processed_rgb = apply_local_contrast(processed_rgb, pixel_coords_i, 2, adjustments.global.sharpness);
    processed_rgb = apply_local_contrast(processed_rgb, pixel_coords_i, 6, adjustments.global.clarity);
    processed_rgb = apply_local_contrast(processed_rgb, pixel_coords_i, 14, adjustments.global.structure);

    // 5. HSL Adjustments
    var hsv = rgb_to_hsv(processed_rgb);
    if (hsv.y > 0.01) {
        var total_hue_shift: f32 = 0.0; var total_sat_adjust: f32 = 0.0; var total_lum_adjust: f32 = 0.0; var total_influence: f32 = 0.0;
        var influence = get_hsl_influence(hsv.x, 0.0, 80.0); if (influence > 0.001) { total_hue_shift += adjustments.global.hsl[0].hue * influence; total_sat_adjust += adjustments.global.hsl[0].saturation * influence; total_lum_adjust += adjustments.global.hsl[0].luminance * influence; total_influence += influence; }
        influence = get_hsl_influence(hsv.x, 30.0, 70.0); if (influence > 0.001) { total_hue_shift += adjustments.global.hsl[1].hue * influence; total_sat_adjust += adjustments.global.hsl[1].saturation * influence; total_lum_adjust += adjustments.global.hsl[1].luminance * influence; total_influence += influence; }
        influence = get_hsl_influence(hsv.x, 60.0, 70.0); if (influence > 0.001) { total_hue_shift += adjustments.global.hsl[2].hue * influence; total_sat_adjust += adjustments.global.hsl[2].saturation * influence; total_lum_adjust += adjustments.global.hsl[2].luminance * influence; total_influence += influence; }
        influence = get_hsl_influence(hsv.x, 120.0, 100.0); if (influence > 0.001) { total_hue_shift += adjustments.global.hsl[3].hue * influence; total_sat_adjust += adjustments.global.hsl[3].saturation * influence; total_lum_adjust += adjustments.global.hsl[3].luminance * influence; total_influence += influence; }
        influence = get_hsl_influence(hsv.x, 180.0, 80.0); if (influence > 0.001) { total_hue_shift += adjustments.global.hsl[4].hue * influence; total_sat_adjust += adjustments.global.hsl[4].saturation * influence; total_lum_adjust += adjustments.global.hsl[4].luminance * influence; total_influence += influence; }
        influence = get_hsl_influence(hsv.x, 240.0, 90.0); if (influence > 0.001) { total_hue_shift += adjustments.global.hsl[5].hue * influence; total_sat_adjust += adjustments.global.hsl[5].saturation * influence; total_lum_adjust += adjustments.global.hsl[5].luminance * influence; total_influence += influence; }
        influence = get_hsl_influence(hsv.x, 285.0, 80.0); if (influence > 0.001) { total_hue_shift += adjustments.global.hsl[6].hue * influence; total_sat_adjust += adjustments.global.hsl[6].saturation * influence; total_lum_adjust += adjustments.global.hsl[6].luminance * influence; total_influence += influence; }
        influence = get_hsl_influence(hsv.x, 330.0, 80.0); if (influence > 0.001) { total_hue_shift += adjustments.global.hsl[7].hue * influence; total_sat_adjust += adjustments.global.hsl[7].saturation * influence; total_lum_adjust += adjustments.global.hsl[7].luminance * influence; total_influence += influence; }
        if (total_influence > 0.001) { let norm_factor = 1.0 / total_influence; hsv.x = (hsv.x + total_hue_shift * norm_factor + 360.0) % 360.0; hsv.y = clamp(hsv.y * (1.0 + total_sat_adjust * norm_factor), 0.0, 1.0); hsv.z = clamp(hsv.z * (1.0 + total_lum_adjust * norm_factor), 0.0, 1.0); }
    }
    processed_rgb = hsv_to_rgb(hsv);

    let srgb_for_curves = linear_to_srgb(processed_rgb);
    // 6. Curves
    var luma_adjusted_srgb = vec3<f32>(apply_curve(srgb_for_curves.r, adjustments.global.luma_curve, adjustments.global.luma_curve_count), apply_curve(srgb_for_curves.g, adjustments.global.luma_curve, adjustments.global.luma_curve_count), apply_curve(srgb_for_curves.b, adjustments.global.luma_curve, adjustments.global.luma_curve_count));
    let curved_srgb = vec3<f32>(apply_curve(luma_adjusted_srgb.r, adjustments.global.red_curve, adjustments.global.red_curve_count), apply_curve(luma_adjusted_srgb.g, adjustments.global.green_curve, adjustments.global.green_curve_count), apply_curve(luma_adjusted_srgb.b, adjustments.global.blue_curve, adjustments.global.blue_curve_count));
    processed_rgb = srgb_to_linear(curved_srgb);

    // 7. Masks
    for (var i = 0u; i < 16u; i = i + 1u) {
        if (i >= adjustments.mask_count) { break; }
        let mask = adjustments.masks[i];
        var influence = 0.0;
        if (mask.mask_type == 1u) { influence = get_radial_mask_influence(original_pixel_coords, mask); } else if (mask.mask_type == 2u) { influence = get_linear_mask_influence(original_pixel_coords, mask); }
        if (mask.invert == 1u) { influence = 1.0 - influence; }
        if (influence > 0.001) { let mask_adjusted_rgb = apply_basic_adjustments(processed_rgb, mask.exposure, mask.contrast, mask.highlights, mask.shadows, mask.whites, mask.blacks, mask.saturation, mask.temperature, mask.tint, mask.vibrance); processed_rgb = mix(processed_rgb, mask_adjusted_rgb, influence); }
    }

    var final_rgb = linear_to_srgb(processed_rgb);

    // 8. Vignette
    if (adjustments.global.vignette_amount != 0.0) {
        let v_amount = adjustments.global.vignette_amount;
        let v_mid = adjustments.global.vignette_midpoint;
        let v_round = 1.0 - adjustments.global.vignette_roundness;
        let v_feather = adjustments.global.vignette_feather * 0.5;
        let aspect = f32(dims.y) / f32(dims.x);
        let uv_centered = (uv - 0.5) * 2.0;
        let uv_round = sign(uv_centered) * pow(abs(uv_centered), vec2<f32>(v_round, v_round));
        let d = length(uv_round * vec2<f32>(1.0, aspect)) * 0.5;
        let vignette_mask = smoothstep(v_mid - v_feather, v_mid + v_feather, d);

        if (v_amount < 0.0) {
            final_rgb *= (1.0 + v_amount * vignette_mask);
        } else {
            final_rgb = mix(final_rgb, vec3<f32>(1.0), v_amount * vignette_mask);
        }
    }

    // 9. Grain
    if (adjustments.global.grain_amount > 0.0) {
        let g_amount = adjustments.global.grain_amount;
        let g_size = adjustments.global.grain_size;
        let g_rough = adjustments.global.grain_roughness;
        let grain_uv = local_coords / g_size;
        let grain_value = rand(floor(grain_uv) + g_rough * rand(floor(grain_uv)));
        let grain_luma = (grain_value - 0.5) * g_amount;
        final_rgb += grain_luma;
    }

    textureStore(output_texture, pixel_coords_i, vec4<f32>(clamp(final_rgb, vec3<f32>(0.0), vec3<f32>(1.0)), color.a));
}