// src-tauri/src/shader.wgsl

struct Point {
    x: f32,
    y: f32,
    _pad1: f32,
    _pad2: f32,
}

struct Adjustments {
    brightness: f32,
    contrast: f32,
    saturation: f32,
    hue: f32,
    curve_points: array<Point, 16>,
    curve_points_count: u32,
    _p1: u32,
    _p2: u32,
    _p3: u32,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var output_texture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> adjustments: Adjustments;

// Converts a color from RGB to HSV color space.
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

// Converts a color from HSV to RGB color space.
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

// Linearly interpolates between two points on the curve.
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

// Applies the RGB curve adjustment to a single color channel value.
fn apply_curve(val: f32, points: array<Point, 16>, count: u32) -> f32 {
    if (count < 2u) {
        if (count == 1u) { return clamp(points[0].y / 255.0, 0.0, 1.0); }
        return val;
    }

    var local_points: array<Point, 16>;
    local_points[0] = points[0];
    local_points[1] = points[1];
    local_points[2] = points[2];
    local_points[3] = points[3];
    local_points[4] = points[4];
    local_points[5] = points[5];
    local_points[6] = points[6];
    local_points[7] = points[7];
    local_points[8] = points[8];
    local_points[9] = points[9];
    local_points[10] = points[10];
    local_points[11] = points[11];
    local_points[12] = points[12];
    local_points[13] = points[13];
    local_points[14] = points[14];
    local_points[15] = points[15];

    let x = val * 255.0;

    if (x <= local_points[0].x) {
        return clamp(local_points[0].y / 255.0, 0.0, 1.0);
    }

    for (var i: u32 = 0u; i < 15u; i = i + 1u) {
        if (i + 1u >= count) {
            return clamp(local_points[i].y / 255.0, 0.0, 1.0);
        }

        if (x <= local_points[i + 1u].x) {
            return interpolate(x, local_points[i], local_points[i + 1u]);
        }
    }

    return clamp(local_points[15].y / 255.0, 0.0, 1.0);
}

// The main entry point for the compute shader.
@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let pixel_coords = vec2<i32>(i32(id.x), i32(id.y));
    
    let dims = textureDimensions(input_texture);
    if (id.x >= dims.x || id.y >= dims.y) { return; }

    var color = textureLoad(input_texture, pixel_coords, 0);

    var rgb_temp = color.rgb + vec3<f32>(adjustments.brightness);
    rgb_temp = 0.5 + (rgb_temp - 0.5) * (adjustments.contrast + 1.0);
    color = vec4<f32>(rgb_temp, color.a);

    if (adjustments.hue != 0.0 || adjustments.saturation != 0.0) {
        var hsv = rgb_to_hsv(color.rgb);
        hsv.x = (hsv.x + adjustments.hue) % 360.0;
        if (hsv.x < 0.0) { hsv.x += 360.0; }
        hsv.y = clamp(hsv.y * (1.0 + adjustments.saturation), 0.0, 1.0);
        color = vec4<f32>(hsv_to_rgb(hsv), color.a);
    }

    if (adjustments.curve_points_count > 0u) {
        let r = apply_curve(color.r, adjustments.curve_points, adjustments.curve_points_count);
        let g = apply_curve(color.g, adjustments.curve_points, adjustments.curve_points_count);
        let b = apply_curve(color.b, adjustments.curve_points, adjustments.curve_points_count);
        color = vec4<f32>(r, g, b, color.a);
    }

    textureStore(output_texture, pixel_coords, clamp(color, vec4<f32>(0.0), vec4<f32>(1.0)));
}