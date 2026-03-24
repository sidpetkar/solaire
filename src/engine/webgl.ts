import {
  VERTEX_SHADER, FRAGMENT_SHADER, PASSTHROUGH_FRAGMENT,
  ADJUST_FRAGMENT, SHARPEN_FRAGMENT, GRAIN_FRAGMENT,
  BLUR_H_FRAGMENT, BLUR_V_FRAGMENT, BLUR_BLEND_FRAGMENT,
} from './shaders';
import { EFFECT_MAP, type EffectParams } from './effects';
import type { AdjustParams, BlurParams } from './adjustments';
import type { ParsedLUT } from '../types';

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${info}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

const QUAD_VERTS = new Float32Array([
  // x,    y,    u,   v
  -1.0, -1.0,  0.0, 0.0,
   1.0, -1.0,  1.0, 0.0,
  -1.0,  1.0,  0.0, 1.0,
   1.0,  1.0,  1.0, 1.0,
]);

interface FBO {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

export class WebGLRenderer {
  private gl: WebGL2RenderingContext;
  private lutProgram: WebGLProgram;
  private passProgram: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private imageTexture: WebGLTexture;
  private lutTexture: WebGLTexture | null = null;
  private intensity = 1.0;
  private hasLut = false;
  private animFrameId = 0;
  private videoSource: HTMLVideoElement | null = null;

  private fboA: FBO | null = null;
  private fboB: FBO | null = null;
  private fboOriginal: FBO | null = null;
  private effectPrograms = new Map<string, WebGLProgram>();
  private activeEffects: EffectParams = {};

  private adjustProgram: WebGLProgram | null = null;
  private sharpenProgram: WebGLProgram | null = null;
  private grainProgram: WebGLProgram | null = null;
  private blurHProgram: WebGLProgram | null = null;
  private blurVProgram: WebGLProgram | null = null;
  private blurBlendProgram: WebGLProgram | null = null;

  private adjustParams: AdjustParams = {};
  private blurParams: BlurParams | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;

    // Float extensions only needed for FBOs in multi-pass, not for LUT textures
    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');

    this.lutProgram = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    this.passProgram = createProgram(gl, VERTEX_SHADER, PASSTHROUGH_FRAGMENT);

    this.vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTS, gl.STATIC_DRAW);

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    const posLoc = gl.getAttribLocation(this.lutProgram, 'a_position');
    const uvLoc = gl.getAttribLocation(this.lutProgram, 'a_uv');

    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);

    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);

    gl.bindVertexArray(null);

    this.imageTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  uploadImage(source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap) {
    const gl = this.gl;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    if (import.meta.env.DEV) {
      const err = gl.getError();
      if (err !== gl.NO_ERROR) console.warn('[WebGL] uploadImage error:', err);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  }

  uploadLUT(lut: ParsedLUT) {
    const gl = this.gl;
    if (!this.lutTexture) {
      this.lutTexture = gl.createTexture()!;
    }
    gl.bindTexture(gl.TEXTURE_3D, this.lutTexture);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const count = lut.size * lut.size * lut.size;
    const rgba = new Uint8Array(count * 4);
    for (let i = 0; i < count; i++) {
      rgba[i * 4 + 0] = Math.round(Math.min(1, Math.max(0, lut.data[i * 3 + 0])) * 255);
      rgba[i * 4 + 1] = Math.round(Math.min(1, Math.max(0, lut.data[i * 3 + 1])) * 255);
      rgba[i * 4 + 2] = Math.round(Math.min(1, Math.max(0, lut.data[i * 3 + 2])) * 255);
      rgba[i * 4 + 3] = 255;
    }

    gl.texImage3D(
      gl.TEXTURE_3D, 0, gl.RGBA8,
      lut.size, lut.size, lut.size,
      0, gl.RGBA, gl.UNSIGNED_BYTE, rgba,
    );
    const err = gl.getError();
    if (err !== gl.NO_ERROR) {
      console.warn('[WebGL] uploadLUT texImage3D error:', err, `(size=${lut.size})`);
    }
    this.hasLut = true;
  }

  clearLUT() {
    this.hasLut = false;
  }

  setIntensity(value: number) {
    this.intensity = Math.max(0, Math.min(1, value));
  }

  setEffects(params: EffectParams) {
    this.activeEffects = params;
  }

  setAdjustments(params: AdjustParams) {
    this.adjustParams = params;
  }

  setBlur(params: BlurParams | null) {
    this.blurParams = params;
  }

  private getActiveEffectIds(): string[] {
    return Object.keys(this.activeEffects);
  }

  private getOrCreateEffectProgram(effectId: string): WebGLProgram | null {
    const cached = this.effectPrograms.get(effectId);
    if (cached) return cached;

    const def = EFFECT_MAP.get(effectId);
    if (!def) return null;

    const program = createProgram(this.gl, VERTEX_SHADER, def.fragmentSource);
    this.effectPrograms.set(effectId, program);
    return program;
  }

  private createFBO(width: number, height: number): FBO {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const framebuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return { framebuffer, texture, width, height };
  }

  private ensureFBOs(width: number, height: number) {
    if (this.fboA && this.fboA.width === width && this.fboA.height === height) return;

    this.destroyFBOs();
    this.fboA = this.createFBO(width, height);
    this.fboB = this.createFBO(width, height);
    this.fboOriginal = this.createFBO(width, height);
  }

  private destroyFBOs() {
    const gl = this.gl;
    for (const fbo of [this.fboA, this.fboB, this.fboOriginal]) {
      if (fbo) {
        gl.deleteFramebuffer(fbo.framebuffer);
        gl.deleteTexture(fbo.texture);
      }
    }
    this.fboA = null;
    this.fboB = null;
    this.fboOriginal = null;
  }

  private drawQuad() {
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  private needsMultiPass(): boolean {
    const adj = this.adjustParams;
    const hasUber = (
      (adj.exposure ?? 0) !== 0 ||
      (adj.contrast ?? 0) !== 0 ||
      (adj.saturation ?? 0) !== 0 ||
      (adj.temperature ?? 0) !== 0 ||
      (adj.tint ?? 0) !== 0 ||
      (adj.vignette ?? 0) !== 0 ||
      (adj.fade ?? 0) !== 0
    );
    const hasSharpen = (adj.sharpen ?? 0) !== 0;
    const hasGrain = (adj.grain_strength ?? 0) !== 0;
    const hasBlur = this.blurParams !== null && this.blurParams.amount > 0;
    const hasEffects = this.getActiveEffectIds().length > 0;
    return hasUber || hasSharpen || hasGrain || hasBlur || hasEffects;
  }

  private getOrCreateProgram(
    cache: 'adjust' | 'sharpen' | 'grain' | 'blurH' | 'blurV' | 'blurBlend',
    fragSource: string,
  ): WebGLProgram {
    const key = cache + 'Program' as
      'adjustProgram' | 'sharpenProgram' | 'grainProgram' | 'blurHProgram' | 'blurVProgram' | 'blurBlendProgram';
    if (!this[key]) {
      this[key] = createProgram(this.gl, VERTEX_SHADER, fragSource);
    }
    return this[key]!;
  }

  render() {
    const gl = this.gl;
    const { width, height } = this.canvas;
    const multiPass = this.needsMultiPass();

    gl.viewport(0, 0, width, height);
    gl.bindVertexArray(this.vao);

    if (multiPass) {
      this.ensureFBOs(width, height);
    }

    let readFBO = this.fboA!;
    let writeFBO = this.fboB!;
    let passCount = 0;

    const renderPass = (
      program: WebGLProgram,
      inputTex: WebGLTexture,
      toScreen: boolean,
      setupUniforms?: () => void,
    ) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, toScreen ? null : writeFBO.framebuffer);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, inputTex);
      gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);
      setupUniforms?.();
      this.drawQuad();
      if (!toScreen) {
        const tmp = readFBO;
        readFBO = writeFBO;
        writeFBO = tmp;
        passCount++;
      }
    };

    // Build list of remaining passes to count them for "isLast" detection
    const adj = this.adjustParams;
    const hasUber = (
      (adj.exposure ?? 0) !== 0 || (adj.contrast ?? 0) !== 0 ||
      (adj.saturation ?? 0) !== 0 || (adj.temperature ?? 0) !== 0 ||
      (adj.tint ?? 0) !== 0 || (adj.vignette ?? 0) !== 0 || (adj.fade ?? 0) !== 0
    );
    const hasSharpen = (adj.sharpen ?? 0) !== 0;
    const hasGrain = (adj.grain_strength ?? 0) !== 0;
    const hasBlur = this.blurParams !== null && this.blurParams.amount > 0;
    const activeEffectIds = this.getActiveEffectIds();
    const hasEffects = activeEffectIds.length > 0;

    const totalExtraPasses =
      (hasUber ? 1 : 0) +
      (hasSharpen ? 1 : 0) +
      (hasGrain ? 1 : 0) +
      (hasBlur ? 3 : 0) +
      activeEffectIds.length;

    // Pass 1: LUT / passthrough -> FBO_A (if multi-pass) or screen
    const lutTarget = multiPass ? readFBO.framebuffer : null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, lutTarget);

    if (this.hasLut && this.lutTexture) {
      gl.useProgram(this.lutProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
      gl.uniform1i(gl.getUniformLocation(this.lutProgram, 'u_image'), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_3D, this.lutTexture);
      gl.uniform1i(gl.getUniformLocation(this.lutProgram, 'u_lut'), 1);
      gl.uniform1f(gl.getUniformLocation(this.lutProgram, 'u_intensity'), this.intensity);
    } else {
      gl.useProgram(this.passProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
      gl.uniform1i(gl.getUniformLocation(this.passProgram, 'u_image'), 0);
    }
    this.drawQuad();

    if (!multiPass) {
      gl.bindVertexArray(null);
      return;
    }

    let remainingPasses = totalExtraPasses;
    const isLast = () => remainingPasses <= 1;
    const decRemaining = () => { remainingPasses--; };

    // Adjust uber-shader pass
    if (hasUber) {
      const prog = this.getOrCreateProgram('adjust', ADJUST_FRAGMENT);
      renderPass(prog, readFBO.texture, isLast(), () => {
        gl.uniform1f(gl.getUniformLocation(prog, 'u_exposure'), (adj.exposure ?? 0) / 100);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_contrast'), (adj.contrast ?? 0) / 100);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_saturation'), (adj.saturation ?? 0) / 100);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_temperature'), (adj.temperature ?? 0) / 100);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_tint'), (adj.tint ?? 0) / 100);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_vignette'), (adj.vignette ?? 0) / 100);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_fade'), (adj.fade ?? 0) / 100);
      });
      decRemaining();
    }

    // Sharpen pass
    if (hasSharpen) {
      const prog = this.getOrCreateProgram('sharpen', SHARPEN_FRAGMENT);
      renderPass(prog, readFBO.texture, isLast(), () => {
        gl.uniform1f(gl.getUniformLocation(prog, 'u_sharpen'), (adj.sharpen ?? 0) / 100);
        gl.uniform2f(gl.getUniformLocation(prog, 'u_texel'), 1.0 / width, 1.0 / height);
      });
      decRemaining();
    }

    // Grain pass
    if (hasGrain) {
      const prog = this.getOrCreateProgram('grain', GRAIN_FRAGMENT);
      renderPass(prog, readFBO.texture, isLast(), () => {
        gl.uniform1f(gl.getUniformLocation(prog, 'u_grain_intensity'), (adj.grain_strength ?? 0) / 100);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_grain_scale'), adj.grain_size ?? 300);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_seed'), Math.random() * 1000);
      });
      decRemaining();
    }

    // Blur passes (3: snapshot original, blur H, blur V, blend)
    if (hasBlur) {
      const bp = this.blurParams!;
      const fboOrig = this.fboOriginal!;

      // Snapshot current result into fboOriginal
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboOrig.framebuffer);
      gl.useProgram(this.passProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, readFBO.texture);
      gl.uniform1i(gl.getUniformLocation(this.passProgram, 'u_image'), 0);
      this.drawQuad();

      // Blur H
      const blurRadius = bp.amount / 10;
      const blurHProg = this.getOrCreateProgram('blurH', BLUR_H_FRAGMENT);
      renderPass(blurHProg, readFBO.texture, false, () => {
        gl.uniform1f(gl.getUniformLocation(blurHProg, 'u_blur_radius'), blurRadius);
        gl.uniform2f(gl.getUniformLocation(blurHProg, 'u_texel'), 1.0 / width, 1.0 / height);
      });
      decRemaining();

      // Blur V
      const blurVProg = this.getOrCreateProgram('blurV', BLUR_V_FRAGMENT);
      renderPass(blurVProg, readFBO.texture, false, () => {
        gl.uniform1f(gl.getUniformLocation(blurVProg, 'u_blur_radius'), blurRadius);
        gl.uniform2f(gl.getUniformLocation(blurVProg, 'u_texel'), 1.0 / width, 1.0 / height);
      });
      decRemaining();

      // Blur blend with mask
      const blendProg = this.getOrCreateProgram('blurBlend', BLUR_BLEND_FRAGMENT);
      const blendToScreen = isLast();
      gl.bindFramebuffer(gl.FRAMEBUFFER, blendToScreen ? null : writeFBO.framebuffer);
      gl.useProgram(blendProg);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fboOrig.texture);
      gl.uniform1i(gl.getUniformLocation(blendProg, 'u_original'), 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, readFBO.texture);
      gl.uniform1i(gl.getUniformLocation(blendProg, 'u_blurred'), 1);

      gl.uniform2f(gl.getUniformLocation(blendProg, 'u_blur_center'), bp.center[0], 1.0 - bp.center[1]);
      gl.uniform1f(gl.getUniformLocation(blendProg, 'u_blur_falloff'), 0.15 + (100 - bp.amount) * 0.004);
      gl.uniform1i(gl.getUniformLocation(blendProg, 'u_blur_mode'), bp.mode === 'circular' ? 0 : 1);
      gl.uniform1f(gl.getUniformLocation(blendProg, 'u_blur_angle'), (bp.angle * Math.PI) / 180);

      this.drawQuad();
      if (!blendToScreen) {
        const tmp = readFBO;
        readFBO = writeFBO;
        writeFBO = tmp;
      }
      decRemaining();
    }

    // FX effect passes
    for (let i = 0; i < activeEffectIds.length; i++) {
      const effectId = activeEffectIds[i];
      const def = EFFECT_MAP.get(effectId);
      if (!def) { decRemaining(); continue; }

      const program = this.getOrCreateEffectProgram(effectId);
      if (!program) { decRemaining(); continue; }

      renderPass(program, readFBO.texture, isLast(), () => {
        def.setUniforms(gl, program!, this.activeEffects[effectId] ?? {});
      });
      decRemaining();
    }

    gl.bindVertexArray(null);
  }

  startVideoLoop(video: HTMLVideoElement) {
    this.videoSource = video;
    const loop = () => {
      if (!this.videoSource) return;
      if (video.readyState >= video.HAVE_CURRENT_DATA) {
        this.uploadImage(video);
        this.render();
      }
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  stopVideoLoop() {
    this.videoSource = null;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
  }

  getMaxTextureSize(): number {
    return this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number;
  }

  isContextLost(): boolean {
    return this.gl.isContextLost();
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  toBlob(type = 'image/jpeg', quality = 0.92): Promise<Blob> {
    this.render();
    return new Promise((resolve, reject) => {
      this.canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('toBlob failed')),
        type,
        quality,
      );
    });
  }

  async exportBlob(
    source: HTMLImageElement | HTMLCanvasElement,
    fullWidth: number,
    fullHeight: number,
    type = 'image/jpeg',
    quality = 0.92,
  ): Promise<Blob> {
    const prevW = this.canvas.width;
    const prevH = this.canvas.height;

    const maxTex = this.getMaxTextureSize();
    const exportScale = Math.min(1, maxTex / fullWidth, maxTex / fullHeight);
    const exportW = Math.round(fullWidth * exportScale);
    const exportH = Math.round(fullHeight * exportScale);

    this.canvas.width = exportW;
    this.canvas.height = exportH;
    this.uploadImage(source);
    const blob = await this.toBlob(type, quality);

    this.canvas.width = prevW;
    this.canvas.height = prevH;
    this.uploadImage(source);
    this.render();

    return blob;
  }

  destroy() {
    this.stopVideoLoop();
    const gl = this.gl;
    gl.deleteTexture(this.imageTexture);
    if (this.lutTexture) gl.deleteTexture(this.lutTexture);
    gl.deleteProgram(this.lutProgram);
    gl.deleteProgram(this.passProgram);
    for (const prog of this.effectPrograms.values()) {
      gl.deleteProgram(prog);
    }
    this.effectPrograms.clear();
    for (const p of [
      this.adjustProgram, this.sharpenProgram, this.grainProgram,
      this.blurHProgram, this.blurVProgram, this.blurBlendProgram,
    ]) {
      if (p) gl.deleteProgram(p);
    }
    this.destroyFBOs();
    gl.deleteBuffer(this.vbo);
    gl.deleteVertexArray(this.vao);
  }
}
