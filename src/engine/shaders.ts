export const VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_uv;
out vec2 v_uv;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_uv = a_uv;
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler3D;

uniform sampler2D u_image;
uniform sampler3D u_lut;
uniform float u_intensity;

in vec2 v_uv;
out vec4 fragColor;

void main() {
  vec4 color = texture(u_image, v_uv);
  float lutSize = float(textureSize(u_lut, 0).x);
  vec3 scale = vec3((lutSize - 1.0) / lutSize);
  vec3 offset = vec3(0.5 / lutSize);
  vec3 graded = texture(u_lut, clamp(color.rgb, 0.0, 1.0) * scale + offset).rgb;
  fragColor = vec4(mix(color.rgb, graded, u_intensity), color.a);
}
`;

export const PASSTHROUGH_FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_image;
in vec2 v_uv;
out vec4 fragColor;

void main() {
  fragColor = texture(u_image, v_uv);
}
`;

export const GRAIN_FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform float u_grain_intensity;
uniform float u_grain_scale;
uniform float u_seed;

in vec2 v_uv;
out vec4 fragColor;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec4 color = texture(u_image, v_uv);
  float lum = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  float response = smoothstep(0.0, 0.9, lum);
  float n = snoise(v_uv * u_grain_scale + vec2(u_seed));
  n = n * 0.5 + 0.5;
  float grain = mix(n, 1.0 - n, response) - 0.5;
  fragColor = vec4(color.rgb + grain * u_grain_intensity, color.a);
}
`;

export const LENS_DISTORTION_FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform float u_distortion;
uniform float u_cubic_distortion;

in vec2 v_uv;
out vec4 fragColor;

void main() {
  vec2 centered = v_uv - 0.5;
  float r2 = dot(centered, centered);
  float f;
  if (u_cubic_distortion == 0.0) {
    f = 1.0 + r2 * u_distortion;
  } else {
    f = 1.0 + r2 * (u_distortion + u_cubic_distortion * sqrt(r2));
  }
  vec2 warped = clamp(f * centered + 0.5, 0.0, 1.0);
  fragColor = texture(u_image, warped);
}
`;

export const CHROMATIC_ABERRATION_FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform float u_aberration_amount;

in vec2 v_uv;
out vec4 fragColor;

void main() {
  vec2 dir = v_uv - 0.5;
  float dist = length(dir);
  vec2 offset = dir * dist * u_aberration_amount;
  float r = texture(u_image, v_uv + offset).r;
  float g = texture(u_image, v_uv).g;
  float b = texture(u_image, v_uv - offset).b;
  float a = texture(u_image, v_uv).a;
  fragColor = vec4(r, g, b, a);
}
`;

export const ADJUST_FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform float u_exposure;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_highlights;
uniform float u_shadows;
uniform float u_saturation;
uniform float u_temperature;
uniform float u_tint;
uniform float u_vignette;
uniform float u_fade;

in vec2 v_uv;
out vec4 fragColor;

void main() {
  vec3 c = texture(u_image, v_uv).rgb;

  // Exposure (multiplicative, EV-style)
  c *= pow(2.0, u_exposure);

  // Brightness (gamma-curve lift/pull, like Lightroom)
  if (u_brightness > 0.0) {
    c = pow(c, vec3(1.0 / (1.0 + u_brightness * 1.5)));
  } else if (u_brightness < 0.0) {
    c = pow(c, vec3(1.0 - u_brightness * 1.5));
  }

  // Contrast
  c = (c - 0.5) * (1.0 + u_contrast) + 0.5;

  // Highlights & Shadows (luminance-weighted, Lightroom-style)
  float lum = clamp(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
  // Highlights: pow mask focuses on bright pixels; positive = recover, negative = boost
  float hMask = pow(lum, 1.5);
  c -= u_highlights * hMask * 0.4;
  // Shadows: pow mask focuses on dark pixels; positive = lift, negative = crush
  float sMask = pow(1.0 - lum, 1.5);
  c += u_shadows * sMask * 0.4;

  // Saturation
  lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(lum), c, 1.0 + u_saturation);

  // White balance
  c.r += u_temperature * 0.08;
  c.b -= u_temperature * 0.08;
  c.g += u_tint * 0.05;
  c.r -= u_tint * 0.02;

  // Fade
  c = c * (1.0 - u_fade) + u_fade * vec3(0.15);

  // Vignette
  float d = length(v_uv - 0.5) * 2.0;
  float vig = smoothstep(0.4, 1.4, d * u_vignette);
  c *= 1.0 - vig;

  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

export const SHARPEN_FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform float u_sharpen;
uniform vec2 u_texel;

in vec2 v_uv;
out vec4 fragColor;

void main() {
  vec3 center = texture(u_image, v_uv).rgb;
  vec3 top    = texture(u_image, v_uv + vec2(0.0, u_texel.y)).rgb;
  vec3 bottom = texture(u_image, v_uv - vec2(0.0, u_texel.y)).rgb;
  vec3 left   = texture(u_image, v_uv - vec2(u_texel.x, 0.0)).rgb;
  vec3 right  = texture(u_image, v_uv + vec2(u_texel.x, 0.0)).rgb;
  vec3 sharp = center * 5.0 - (top + bottom + left + right);
  fragColor = vec4(clamp(mix(center, sharp, u_sharpen), 0.0, 1.0), 1.0);
}
`;

export const BLUR_H_FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform float u_blur_radius;
uniform vec2 u_texel;

in vec2 v_uv;
out vec4 fragColor;

void main() {
  float w[7] = float[](0.1898, 0.1618, 0.1141, 0.0697, 0.0367, 0.0164, 0.0063);
  vec3 sum = texture(u_image, v_uv).rgb * w[0];
  for (int i = 1; i < 7; i++) {
    float off = float(i) * u_blur_radius;
    sum += texture(u_image, v_uv + vec2(u_texel.x * off, 0.0)).rgb * w[i];
    sum += texture(u_image, v_uv - vec2(u_texel.x * off, 0.0)).rgb * w[i];
  }
  fragColor = vec4(sum, 1.0);
}
`;

export const BLUR_V_FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform float u_blur_radius;
uniform vec2 u_texel;

in vec2 v_uv;
out vec4 fragColor;

void main() {
  float w[7] = float[](0.1898, 0.1618, 0.1141, 0.0697, 0.0367, 0.0164, 0.0063);
  vec3 sum = texture(u_image, v_uv).rgb * w[0];
  for (int i = 1; i < 7; i++) {
    float off = float(i) * u_blur_radius;
    sum += texture(u_image, v_uv + vec2(0.0, u_texel.y * off)).rgb * w[i];
    sum += texture(u_image, v_uv - vec2(0.0, u_texel.y * off)).rgb * w[i];
  }
  fragColor = vec4(sum, 1.0);
}
`;

export const BLUR_BLEND_FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_original;
uniform sampler2D u_blurred;
uniform vec2 u_blur_center;
uniform float u_blur_falloff;
uniform int u_blur_mode;
uniform float u_blur_angle;

in vec2 v_uv;
out vec4 fragColor;

void main() {
  vec3 orig = texture(u_original, v_uv).rgb;
  vec3 blur = texture(u_blurred, v_uv).rgb;

  float dist;
  if (u_blur_mode == 0) {
    dist = length(v_uv - u_blur_center);
  } else {
    float a = u_blur_angle;
    vec2 dir = vec2(cos(a), sin(a));
    dist = abs(dot(v_uv - u_blur_center, dir));
  }

  float inner = u_blur_falloff * 0.3;
  float outer = u_blur_falloff;
  float mask = smoothstep(inner, outer, dist);
  fragColor = vec4(mix(orig, blur, mask), 1.0);
}
`;
