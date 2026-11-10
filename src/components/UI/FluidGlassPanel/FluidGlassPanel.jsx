import React, { useEffect, useRef, useState, useCallback, useImperativeHandle } from 'react';
import './FluidGlassPanel.css';

const PIXEL_BUDGET = 5e6;
const SHADOW_SIZE = 160;

const VERTEX = `#version 300 es
const vec2 corners[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
  gl_Position = vec4(corners[gl_VertexID], 0.0, 1.0);
}`;

const CONTENT = `#version 300 es
precision highp float;
uniform vec2 uView;
uniform float uRatio;
uniform sampler2D uMedia;
uniform vec4 uMediaRect;
uniform float uMediaOn;
uniform sampler2D uText;
uniform float uTextOn;
uniform vec4 uBackground;
out vec4 fragColor;

void main() {
  vec2 w = gl_FragCoord.xy / uRatio;
  vec2 uv = vec2(w.x, uView.y - w.y) / uView;
  vec4 color = uBackground;
  if (uMediaOn > 0.5) {
    vec2 m = (uv - uMediaRect.xy) / uMediaRect.zw;
    if (m.x >= 0.0 && m.y >= 0.0 && m.x <= 1.0 && m.y <= 1.0) {
      vec4 media = texture(uMedia, m);
      color = media + color * (1.0 - media.a);
    }
  }
  if (uTextOn > 0.5) {
    vec4 text = texture(uText, uv);
    color = text + color * (1.0 - text.a);
  }
  fragColor = color;
}`;

const SDF_CUBE = `{
  vec3 q = abs(p) - vec3(0.6);
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - 0.16;
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uView;
uniform float uRatio;
uniform float uFocal;
uniform vec3 uCenter;
uniform mat3 uInverse;
uniform float uScale;
uniform float uBound;
uniform float uMorph;
uniform float uRipple;
uniform float uTime;
uniform float uIor;
uniform float uDispersion;
uniform float uReflection;
uniform float uFrost;
uniform vec4 uTint;
uniform float uShadow;
uniform vec3 uLight;
uniform float uPresence;
uniform sampler2D uMedia;
uniform vec4 uMediaRect;
uniform float uMediaOn;
uniform sampler2D uText;
uniform float uTextOn;
uniform vec4 uBackground;
uniform float uPass;
uniform sampler2D uShadowMap;
uniform vec4 uShadowBox;
uniform vec2 uShadowSize;
out vec4 fragColor;

float shapeA(vec3 p) ${SDF_CUBE}
float shapeB(vec3 p) ${SDF_CUBE}

float field(vec3 p) {
  float d = shapeA(p);
  if (uRipple > 0.0) {
    d += uRipple * sin(p.x * 3.1 + uTime * 2.3) * sin(p.y * 3.4 - uTime * 1.9) * sin(p.z * 2.9 + uTime * 1.6);
  }
  return d;
}

float map(vec3 w) {
  return field(uInverse * (w - uCenter)) * uScale;
}

vec3 normalAt(vec3 w) {
  float e = 0.35;
  vec2 k = vec2(1.0, -1.0);
  return normalize(
    k.xyy * map(w + k.xyy * e) +
    k.yxy * map(w + k.yxy * e) +
    k.yyx * map(w + k.yyx * e)
  );
}

float shadowAt(vec3 ro, vec3 rd) {
  float t = 0.0;
  float occlusion = 1.0;
  for (int i = 0; i < 28; i++) {
    float h = map(ro + rd * t);
    if (h > 0.0) occlusion = min(occlusion, 6.0 * h / t);
    if (t > uCenter.z * 2.6 + uBound * 2.0) break;
    t += clamp(abs(h) * 0.8, 2.0, uBound * 0.25);
  }
  return occlusion;
}

struct GlassTrace {
  bool hit;
  float t;
  vec3 normal;
  vec3 exitNormal;
  vec3 exitDir;
  bool escaped;
  float travel;
  int bounces;
}

GlassTrace glassTraceRay(vec3 ro, vec3 rd) {
  GlassTrace tr;
  tr.hit = false;
  tr.t = 0.0;
  tr.normal = vec3(0.0);
  tr.exitDir = rd;
  tr.escaped = false;
  tr.travel = 0.0;
  tr.bounces = 0;

  vec3 oc = ro - uCenter;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - uBound * uBound;
  float disc = b * b - c;
  if (disc <= 0.0 || uPresence <= 0.0) return tr;
  float sq = sqrt(disc);
  float t = max(-b - sq, 0.0);
  float tEnd = -b + sq;
  float closest = 1e5;
  float closestT = t;
  bool hit = false;
  for (int i = 0; i < 96; i++) {
    float d = map(ro + rd * t);
    if (d < closest) {
      closest = d;
      closestT = t;
    }
    if (d < 0.001) {
      hit = true;
      break;
    }
    t += d * 0.9;
    if (t > tEnd) break;
  }
  if (!hit && closest < 0.35) {
    hit = true;
    t = closestT;
  }
  if (!hit) return tr;

  tr.hit = true;
  tr.t = t;
  vec3 q = ro + rd * t;
  tr.normal = normalAt(q);

  vec3 inside = rd;
  vec3 exitDir = rd;
  bool escaped = false;
  for (int bounce = 0; bounce < 3; bounce++) {
    for (int i = 0; i < 64; i++) {
      float d = map(q);
      if (d > -0.001) break;
      float stepLength = max(-d * 0.9, 0.001);
      q += inside * stepLength;
      tr.travel += stepLength;
    }
    vec3 n2 = normalAt(q);
    tr.exitNormal = n2;
    vec3 out1 = refract(inside, -n2, uIor);
    if (dot(out1, out1) > 0.0) {
      exitDir = out1;
      escaped = true;
      break;
    }
    inside = reflect(inside, -n2);
    q += inside * 0.004;
    tr.bounces += 1.0;
  }
  if (!escaped) exitDir = inside;

  tr.exitDir = exitDir;
  tr.escaped = escaped;
  return tr;
}

vec4 light(vec3 dir, float strength) {
  float diff = max(dot(normalize(dir), uLight), 0.0);
  return vec4(1.0, 1.0, 1.0, 1.0) * diff * strength;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uView;
  vec3 ro = uCenter;
  vec3 rd = normalize(vec3((uv - 0.5) * uView.x / uFocal, -1.0));
  rd = uInverse * rd;

  GlassTrace tr = glassTraceRay(ro, rd);

  vec4 color = uBackground;
  vec4 refractedColor = vec4(0.0);
  if (tr.hit) {
    vec3 refracted = tr.exitDir;
    vec2 sampleUv = uv + refracted.xy * 0.15 * uFrost;
    if (sampleUv.x >= 0.0 && sampleUv.x <= 1.0 && sampleUv.y >= 0.0 && sampleUv.y <= 1.0) {
      refractedColor = texture(uMedia, sampleUv);
      color = refractedColor + color * (1.0 - refractedColor.a);
    }

    float cosi = -dot(tr.normal, rd);
    float fresnel = mix(1.0 - cosi, 1.0, uReflection * 0.5);
    vec4 reflected = vec4(1.0, 1.0, 1.0, 1.0) * fresnel;
    vec4 glass = reflected + refractedColor * (1.0 - reflected.a);

    float edge = 1.0 - smoothstep(0.04, 0.3, cosi);
    glass = mix(glass, uBackground * (1.0 - uBackground.a), edge);

    float thickness = tr.travel * 0.5;
    vec3 tint = uTint.rgb * (1.0 - exp(-thickness * uTint.a));
    glass.rgb += tint;

    color = mix(color, glass, uPresence);
  }

  if (uShadow > 0.0) {
    float shadow = shadowAt(ro, normalize(vec3(0.0, -1.0, 0.5)));
    color.rgb *= mix(1.0, shadow, uShadow * 0.6);
  }

  fragColor = color;
}`;

const compile = (gl, type, source) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    console.error('Shader source (first 2000 chars):', source.slice(0, 2000));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const parseColor = (c) => {
  if (!c) return [0, 0, 0, 0];
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const full = hex[1].length === 3 ? hex[1].replace(/./g, d => d + d) : hex[1];
    return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255).concat(1);
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?/i.exec(c);
  if (rgb) {
    const a = rgb[4] === undefined ? 1 : rgb[4].endsWith('%') ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
    return [rgb[1], rgb[2], rgb[3]].map(ch => clamp(parseFloat(ch) / 255, 0, 1)).concat(clamp(a, 0, 1));
  }
  return [0, 0, 0, 0];
};

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

const FluidGlassPanel = React.forwardRef(function FluidGlassPanel(props, ref) {
  const {
    children,
    refraction = 0.25,
    spin = 0,
    frost = 0.5,
    shadow = 1,
    dispersion = 1,
    color = '#ffffff',
    tint = 0.3,
    size = 400,
    elevation = 0.4,
    interaction = 'follow',
    smoothness = 0.5,
    wobble = 0.5,
    idle = true,
    intro = true,
    className = '',
    style,
  } = props;
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [generation, setGeneration] = useState(0);

  const settingsRef = useRef({
    ior: 1 + 0.5 * clamp(refraction, 0, 2),
    dispersion: clamp(dispersion, 0, 1),
    reflection: clamp(1, 0, 2),
    frost: clamp(frost, 0, 1),
    tint: parseColor(color),
    tintAmount: clamp(tint, 0, 1),
    shadow: clamp(shadow, 0, 1),
    size: Math.max(64, size),
    elevation,
    interaction,
    smoothness,
    wobble,
    spin,
    idle,
    intro,
  });
  settingsRef.current = settingsRef.current;

  useImperativeHandle(ref, () => containerRef.current);

  const pointerRef = useRef({ x: 0, y: 0, grabbed: false, offsetX: 0, offsetY: 0 });
  const bodyRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, dirX: 0, dirY: 0, stretch: 1, ripple: 0 });
  const timeRef = useRef(0);
  const rafRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    pointerRef.current.x = e.clientX - rect.left;
    pointerRef.current.y = e.clientY - rect.top;
  }, []);

  const handleMouseDown = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    pointerRef.current.grabbed = true;
    pointerRef.current.offsetX = e.clientX - rect.left - bodyRef.current.x;
    pointerRef.current.offsetY = e.clientY - rect.top - bodyRef.current.y;
  }, []);

  const handleMouseUp = useCallback(() => {
    pointerRef.current.grabbed = false;
  }, []);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const touch = e.touches[0];
    pointerRef.current.x = touch.clientX - rect.left;
    pointerRef.current.y = touch.clientY - rect.top;
  }, []);

  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const touch = e.touches[0];
    pointerRef.current.grabbed = true;
    pointerRef.current.offsetX = touch.clientX - rect.left - bodyRef.current.x;
    pointerRef.current.offsetY = touch.clientY - rect.top - bodyRef.current.y;
  }, []);

  const handleTouchEnd = useCallback(() => {
    pointerRef.current.grabbed = false;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    if (!gl) return;

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const contentFrag = compile(gl, gl.FRAGMENT_SHADER, CONTENT);
    const mainFrag = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vertex || !contentFrag || !mainFrag) return;

    const contentProgram = gl.createProgram();
    gl.attachShader(contentProgram, contentFrag);
    gl.attachShader(contentProgram, vertex);
    gl.linkProgram(contentProgram);

    const mainProgram = gl.createProgram();
    gl.attachShader(mainProgram, mainFrag);
    gl.attachShader(mainProgram, vertex);
    gl.linkProgram(mainProgram);

    const buffer = gl.createBuffer();
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const contentUniforms = {
      uView: gl.getUniformLocation(contentProgram, 'uView'),
      uRatio: gl.getUniformLocation(contentProgram, 'uRatio'),
      uMedia: gl.getUniformLocation(contentProgram, 'uMedia'),
      uMediaRect: gl.getUniformLocation(contentProgram, 'uMediaRect'),
      uMediaOn: gl.getUniformLocation(contentProgram, 'uMediaOn'),
      uText: gl.getUniformLocation(contentProgram, 'uText'),
      uTextOn: gl.getUniformLocation(contentProgram, 'uTextOn'),
      uBackground: gl.getUniformLocation(contentProgram, 'uBackground'),
    };

    const mainUniforms = {
      uView: gl.getUniformLocation(mainProgram, 'uView'),
      uRatio: gl.getUniformLocation(mainProgram, 'uRatio'),
      uFocal: gl.getUniformLocation(mainProgram, 'uFocal'),
      uCenter: gl.getUniformLocation(mainProgram, 'uCenter'),
      uInverse: gl.getUniformLocation(mainProgram, 'uInverse'),
      uScale: gl.getUniformLocation(mainProgram, 'uScale'),
      uBound: gl.getUniformLocation(mainProgram, 'uBound'),
      uMorph: gl.getUniformLocation(mainProgram, 'uMorph'),
      uRipple: gl.getUniformLocation(mainProgram, 'uRipple'),
      uTime: gl.getUniformLocation(mainProgram, 'uTime'),
      uIor: gl.getUniformLocation(mainProgram, 'uIor'),
      uDispersion: gl.getUniformLocation(mainProgram, 'uDispersion'),
      uReflection: gl.getUniformLocation(mainProgram, 'uReflection'),
      uFrost: gl.getUniformLocation(mainProgram, 'uFrost'),
      uTint: gl.getUniformLocation(mainProgram, 'uTint'),
      uShadow: gl.getUniformLocation(mainProgram, 'uShadow'),
      uLight: gl.getUniformLocation(mainProgram, 'uLight'),
      uPresence: gl.getUniformLocation(mainProgram, 'uPresence'),
      uMedia: gl.getUniformLocation(mainProgram, 'uMedia'),
      uMediaRect: gl.getUniformLocation(mainProgram, 'uMediaRect'),
      uMediaOn: gl.getUniformLocation(mainProgram, 'uMediaOn'),
      uText: gl.getUniformLocation(mainProgram, 'uText'),
      uTextOn: gl.getUniformLocation(mainProgram, 'uTextOn'),
      uBackground: gl.getUniformLocation(mainProgram, 'uBackground'),
      uPass: gl.getUniformLocation(mainProgram, 'uPass'),
      uShadowMap: gl.getUniformLocation(mainProgram, 'uShadowMap'),
      uShadowBox: gl.getUniformLocation(mainProgram, 'uShadowBox'),
      uShadowSize: gl.getUniformLocation(mainProgram, 'uShadowSize'),
    };

    const mediaCanvas = document.createElement('canvas');
    const mediaCtx = mediaCanvas.getContext('2d');
    const mediaTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, mediaTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const textCanvas = document.createElement('canvas');
    const textCtx = textCanvas.getContext('2d');
    const textTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const shadowFbo = gl.createFramebuffer();
    const shadowTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SHADOW_SIZE, SHADOW_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, shadowTexture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    let animationId;
    let lastTime = 0;

    const animate = (time) => {
      if (!lastTime) lastTime = time;
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;
      timeRef.current += dt;

      const s = settingsRef.current;
      const p = pointerRef.current;
      const body = bodyRef.current;

      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.floor(rect.width * dpr);
      const height = Math.floor(rect.height * dpr);
      if (width > 0 && height > 0) {
        canvas.width = width;
        canvas.height = height;
      }
      if (width === 0 || height === 0) {
        animationId = requestAnimationFrame(animate);
        return;
      }

      const ratio = width / height;
      const view = { width, height, ratio };

      const unit = Math.min(width, height) / s.size;
      const scale = 1 / unit;

      const cx = view.width / 2 + (p.x - view.width / 2) * 0.3;
      const cy = view.height / 2 + (p.y - view.height / 2) * 0.3;
      const heightZ = unit * (0.35 + s.elevation);

      const sx = Math.max(0.2, body.stretch);
      const q = 1 / Math.sqrt(sx);
      const ux = body.dirX;
      const uy = -body.dirY;
      const inv = [
        1 / q + (1 / sx - 1 / q) * ux * ux,
        (1 / sx - 1 / q) * ux * uy,
        0,
        (1 / sx - 1 / q) * ux * uy,
        1 / q + (1 / sx - 1 / q) * uy * uy,
        0,
        0,
        0,
        1 / q,
      ];

      const focal = Math.max(view.width, view.height) * 1.6;
      const worldY = view.height - cy;
      const centerX = view.width / 2 + (cx - view.width / 2) * ((focal - heightZ) / focal);
      const centerY = view.height / 2 + (worldY - view.height / 2) * ((focal - heightZ) / focal);

      if (s.interaction === 'follow' && !p.grabbed) {
        const omega = 24 * Math.pow(0.18, s.smoothness) * 1;
        const substeps = Math.max(1, Math.ceil(dt / (1 / 240)));
        const h = dt / substeps;
        for (let i = 0; i < substeps; i++) {
          body.x += (p.x - body.x) * omega * h;
          body.y += (p.y - body.y) * omega * h;
          body.vx *= Math.exp(-h * 1.4);
          body.vy *= Math.exp(-h * 1.4);
        }
        body.dirX = (p.x - body.x) * 0.002;
        body.dirY = (p.y - body.y) * 0.002;
      } else if (s.idle && !p.grabbed) {
        const t = timeRef.current;
        body.x = view.width / 2 + Math.sin(t * 0.5) * view.width * 0.05;
        body.y = view.height / 2 + Math.cos(t * 0.3) * view.height * 0.05;
        body.dirX = Math.sin(t * 0.7) * 0.001;
        body.dirY = Math.cos(t * 0.5) * 0.001;
      }

      body.stretch = 1 + Math.abs(body.vx) * 0.1 + Math.abs(body.vy) * 0.1;
      body.ripple = Math.abs(body.vx) + Math.abs(body.vy);

      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(contentProgram);
      gl.bindVertexArray(vao);
      gl.uniform2f(contentUniforms.uView, width, height);
      gl.uniform1f(contentUniforms.uRatio, ratio);
      gl.uniform1i(contentUniforms.uMediaOn, 0);
      gl.uniform1i(contentUniforms.uTextOn, 0);
      gl.uniform4f(contentUniforms.uBackground, 0, 0, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.useProgram(mainProgram);
      gl.bindVertexArray(vao);
      gl.uniform2f(mainUniforms.uView, width, height);
      gl.uniform1f(mainUniforms.uRatio, ratio);
      gl.uniform1f(mainUniforms.uFocal, focal);
      gl.uniform3f(mainUniforms.uCenter, centerX, centerY, heightZ);
      gl.uniformMatrix3fv(mainUniforms.uInverse, false, inv);
      gl.uniform1f(mainUniforms.uScale, unit * scale);
      gl.uniform1f(mainUniforms.uBound, s.size * scale * 1.08 + 2);
      gl.uniform1f(mainUniforms.uMorph, 0);
      gl.uniform1f(mainUniforms.uRipple, body.ripple);
      gl.uniform1f(mainUniforms.uTime, timeRef.current);
      gl.uniform1f(mainUniforms.uIor, s.ior);
      gl.uniform1f(mainUniforms.uDispersion, s.dispersion);
      gl.uniform1f(mainUniforms.uReflection, s.reflection);
      gl.uniform1f(mainUniforms.uFrost, s.frost);
      gl.uniform4f(mainUniforms.uTint, s.tint[0], s.tint[1], s.tint[2], s.tintAmount);
      gl.uniform1f(mainUniforms.uShadow, s.shadow);
      gl.uniform3f(mainUniforms.uLight, 0.5, 1, 0.5);
      gl.uniform1f(mainUniforms.uPresence, 1);
      gl.uniform1i(mainUniforms.uMediaOn, 0);
      gl.uniform1i(mainUniforms.uTextOn, 0);
      gl.uniform4f(mainUniforms.uBackground, 0, 0, 0, 0);
      gl.uniform1i(mainUniforms.uPass, 0);
      gl.uniform1i(mainUniforms.uShadowMap, 0);
      gl.uniform4f(mainUniforms.uShadowBox, 0, 0, 0, 0);
      gl.uniform2f(mainUniforms.uShadowSize, SHADOW_SIZE, SHADOW_SIZE);

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
      gl.deleteProgram(contentProgram);
      gl.deleteProgram(mainProgram);
      gl.deleteShader(vertex);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteTexture(mediaTexture);
      gl.deleteTexture(textTexture);
      gl.deleteTexture(shadowTexture);
      gl.deleteFramebuffer(shadowFbo);
    };
  }, [generation, handleMouseMove, handleMouseDown, handleMouseUp, handleTouchMove, handleTouchStart, handleTouchEnd]);

  return (
    <div
      ref={containerRef}
      className={`fluid-glass-panel ${className}`}
      style={style}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} className="fluid-glass-panel__canvas" aria-hidden="true" />
      <div className="fluid-glass-panel__content">{children}</div>
    </div>
  );
});

export default FluidGlassPanel;