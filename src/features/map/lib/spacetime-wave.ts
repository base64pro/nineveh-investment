// م7.6 · نسيج الزمكان الحي v3 — «شبكة شعرية مات»: خطوط دقيقة جداً خفيفة بلا لمعان ولا بياض حاد،
// تتموّج بحركة مائية بطيئة سلسة فوق سطح ارتفاع كحلي مكتوم بخطوط كنتور خافتة تنساب —
// ويتلاشى النسيج كلياً مع التقريب (يختفي عند z≥12) لوضوح عملي مريح، وتتوقف حلقة الرسم حينها.
// Vertex Shader يزيح عقد الشبكة «عمودياً» (محور Y الميركاتوري) بثلاث أوكتافات Simplex Noise
// مع زمن متقدّم كل إطار (rAF) — حقل متّصل لا ينكسر، والقصّ على نينوى بقناع ألفا ناعم.
// CustomLayerInterface = نفس خط WebGL الذي تغلّفه Three.js/ShaderMaterial — ضمن الحزمة الثابتة.

import { MercatorCoordinate } from "maplibre-gl";
import type { CustomLayerInterface, CustomRenderMethodInput, Map as GLMap } from "maplibre-gl";
import type { FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";

export const SPACETIME_WAVE_LAYER = "spacetime-wave";

// حضور خفيف يتلاشى للصفر مع التقريب (تجربة عملية: التفاصيل تتقدّم والنسيج ينسحب)
const OPACITY_STOPS: ReadonlyArray<readonly [number, number]> = [
  [5, 0.5],
  [8, 0.38],
  [10, 0.18],
  [12, 0],
];
const FADE_END_ZOOM = 12.2; // بعده لا رسم ولا إعادة إطارات — راحة وأداء

function zoomOpacity(z: number): number {
  const first = OPACITY_STOPS[0];
  const last = OPACITY_STOPS[OPACITY_STOPS.length - 1];
  if (!first || !last) return 0;
  if (z <= first[0]) return first[1];
  if (z >= last[0]) return last[1];
  for (let i = 0; i < OPACITY_STOPS.length - 1; i++) {
    const a = OPACITY_STOPS[i];
    const b = OPACITY_STOPS[i + 1];
    if (a && b && z >= a[0] && z <= b[0]) {
      const t = (z - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * t;
    }
  }
  return last[1];
}

// ضجيج Simplex ثنائي الأبعاد — تنفيذ Ashima Arts/Stefan Gustavson (webgl-noise، ملكية عامة)
const SNOISE_GLSL = /* glsl */ `
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
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
`;

const VERTEX_SRC = /* glsl */ `
precision highp float;
attribute vec2 a_pos;
uniform mat4 u_matrix;
uniform float u_time;
uniform vec2 u_origin;
uniform vec2 u_extent;
uniform float u_amp;
varying float v_wave;
varying vec2 v_uv;
${SNOISE_GLSL}
void main() {
  v_uv = (a_pos - u_origin) / u_extent;
  vec2 p = (a_pos - u_origin) / u_extent.x; // مقياس موحّد = موجات متجانسة الاتجاهات
  float t = u_time;
  // ثلاث أوكتافات هادئة بسرعات واتجاهات متباينة — تموّج مائي سلس متجدّد بلا توقف (تسريع طفيف ×1.25)
  float h = snoise(p * 7.0  + vec2( 0.170,  0.115) * t) * 0.55
          + snoise(p * 16.0 + vec2(-0.240,  0.160) * t) * 0.30
          + snoise(p * 33.0 + vec2( 0.150, -0.310) * t) * 0.15;
  v_wave = h;
  // الإزاحة «العمودية» للمشهد العلوي: محور Y الميركاتوري + رجفة X مائية طفيفة
  vec2 disp = vec2(0.22, 1.0) * (h * u_amp);
  gl_Position = u_matrix * vec4(a_pos + disp, 0.0, 1.0);
}
`;

const FRAGMENT_SRC = /* glsl */ `
precision mediump float;
uniform sampler2D u_mask;
uniform float u_opacity;
uniform highp float u_time; // مشترك مع الرأسي — وجوب تطابق الدقّة وإلا فشل الربط
uniform highp float u_detail; // مشترك مع الرأسي (نفس قاعدة الدقّة)
uniform int u_mode; // 0 سطح الارتفاع · 1 الشبكة الشعرية
varying float v_wave;
varying vec2 v_uv;

// تدرّج كحلي مكتوم ← ثلجي مطفأ — مات بالكامل: لا أبيض ولا لمعان
vec3 ramp(float c) {
  vec3 deep = vec3(0.15, 0.24, 0.42);
  vec3 ice  = vec3(0.62, 0.73, 0.87);
  return mix(deep, ice, c);
}

void main() {
  float m = texture2D(u_mask, v_uv).a; // قناع نينوى الناعم — يقصّ الظهور لا الحقل
  if (m < 0.004) discard;
  float c01 = clamp(0.5 + 0.5 * v_wave, 0.0, 1.0);
  vec3 col = ramp(c01);
  float a;
  if (u_mode == 0) {
    // سطح ارتفاع خافت جداً + كنتور طبوغرافي شبحي ينساب ببطء (عمق هولوكرامي مات)
    float iso = abs(fract(c01 * 5.0 - u_time * 0.075) - 0.5);
    float contour = smoothstep(0.09, 0.025, iso);
    a = u_opacity * m * (0.018 + 0.065 * c01 + 0.035 * contour);
  } else {
    // الشبكة الشعرية: وضوح أعلى قليلاً للخطوط حصراً (ألفا + رفع لوني طفيف) — نفس السمك والشكل، بلا وميض
    col *= 1.06;
    a = u_opacity * m * (0.10 + 0.32 * c01) * (0.55 + 0.45 * u_detail);
  }
  gl_FragColor = vec4(col * a, a); // premultiplied
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("spacetime-wave shader:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function toMerc(pos: Position): [number, number] {
  const c = MercatorCoordinate.fromLngLat({ lng: pos[0] ?? 0, lat: pos[1] ?? 0 });
  return [c.x, c.y];
}

function collectRings(gov: FeatureCollection): Position[][][] {
  const polys: Position[][][] = [];
  for (const f of gov.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "Polygon") polys.push((g as Polygon).coordinates);
    else if (g.type === "MultiPolygon") for (const p of (g as MultiPolygon).coordinates) polys.push(p);
  }
  return polys;
}

interface Mesh {
  nodes: Float32Array;
  nodeCount: number;
  lineIdx: Uint16Array | Uint32Array;
  triIdx: Uint16Array | Uint32Array;
  origin: [number, number];
  extent: [number, number];
  cell: number;
}

// شبكة عقد مفهرسة دقيقة (شعرية) في فضاء ميركاتور: مثلّثات للسطح + أزواج للخطوط
function buildMesh(polys: Position[][][]): Mesh | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of polys)
    for (const ring of poly)
      for (const pos of ring) {
        const [x, y] = toMerc(pos);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return null;

  const margin = (maxX - minX) * 0.03;
  minX -= margin;
  minY -= margin;
  maxX += margin;
  maxY += margin;

  const extX = maxX - minX;
  const extY = maxY - minY;
  const COLS = 160; // أدقّ — خطوط شعرية
  const cell = extX / COLS;
  const ROWS = Math.min(200, Math.max(8, Math.round(extY / cell)));
  const cellY = extY / ROWS;

  const nodes = new Float32Array((COLS + 1) * (ROWS + 1) * 2);
  let n = 0;
  for (let j = 0; j <= ROWS; j++)
    for (let i = 0; i <= COLS; i++) {
      nodes[n++] = minX + cell * i;
      nodes[n++] = minY + cellY * j;
    }
  const nodeCount = (COLS + 1) * (ROWS + 1);
  const at = (i: number, j: number): number => j * (COLS + 1) + i;

  const lines: number[] = [];
  for (let j = 0; j <= ROWS; j++) for (let i = 0; i < COLS; i++) lines.push(at(i, j), at(i + 1, j));
  for (let i = 0; i <= COLS; i++) for (let j = 0; j < ROWS; j++) lines.push(at(i, j), at(i, j + 1));

  const tris: number[] = [];
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      const a = at(i, j);
      const b = at(i + 1, j);
      const c = at(i, j + 1);
      const d = at(i + 1, j + 1);
      tris.push(a, b, c, b, d, c);
    }

  const IndexArray = nodeCount > 65535 ? Uint32Array : Uint16Array;
  return {
    nodes,
    nodeCount,
    lineIdx: new IndexArray(lines),
    triIdx: new IndexArray(tris),
    origin: [minX, minY],
    extent: [extX, extY],
    cell,
  };
}

// قناع نينوى: مضلّع المحافظة أبيض على شفاف بضباب 3px (حافة متلاشية) — texture ألفا
function buildMaskCanvas(polys: Position[][][], origin: [number, number], extent: [number, number]): HTMLCanvasElement {
  const W = 1024;
  const H = Math.min(2048, Math.max(256, Math.round((W * extent[1]) / extent[0])));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  if (!g) return c;
  g.filter = "blur(3px)";
  g.fillStyle = "#fff";
  for (const poly of polys) {
    const path = new Path2D();
    for (const ring of poly) {
      ring.forEach((pos, idx) => {
        const [mx, my] = toMerc(pos);
        const px = ((mx - origin[0]) / extent[0]) * W;
        const py = ((my - origin[1]) / extent[1]) * H;
        if (idx === 0) path.moveTo(px, py);
        else path.lineTo(px, py);
      });
      path.closePath();
    }
    g.fill(path, "evenodd");
  }
  return c;
}

export function createSpacetimeWave(gov: FeatureCollection): CustomLayerInterface | null {
  const polys = collectRings(gov);
  if (polys.length === 0) return null;
  const mesh = buildMesh(polys);
  if (!mesh) return null;
  const idxType = mesh.nodeCount > 65535 ? "uint32" : "uint16";

  let map: GLMap | null = null;
  let program: WebGLProgram | null = null;
  let nodeBuf: WebGLBuffer | null = null;
  let lineBuf: WebGLBuffer | null = null;
  let triBuf: WebGLBuffer | null = null;
  let maskTex: WebGLTexture | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let rafId = 0;
  let aPos = 0;
  let uMatrix: WebGLUniformLocation | null = null;
  let uTime: WebGLUniformLocation | null = null;
  let uOrigin: WebGLUniformLocation | null = null;
  let uExtent: WebGLUniformLocation | null = null;
  let uAmp: WebGLUniformLocation | null = null;
  let uMask: WebGLUniformLocation | null = null;
  let uOpacity: WebGLUniformLocation | null = null;
  let uMode: WebGLUniformLocation | null = null;
  let uDetail: WebGLUniformLocation | null = null;
  const t0 = performance.now();

  return {
    id: SPACETIME_WAVE_LAYER,
    type: "custom",
    renderingMode: "2d",

    onAdd(m: GLMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
      map = m;
      const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SRC);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
      if (!vs || !fs) return;
      const prog = gl.createProgram();
      if (!prog) return;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error("spacetime-wave link:", gl.getProgramInfoLog(prog));
        gl.deleteProgram(prog);
        return;
      }
      program = prog;
      aPos = gl.getAttribLocation(prog, "a_pos");
      uMatrix = gl.getUniformLocation(prog, "u_matrix");
      uTime = gl.getUniformLocation(prog, "u_time");
      uOrigin = gl.getUniformLocation(prog, "u_origin");
      uExtent = gl.getUniformLocation(prog, "u_extent");
      uAmp = gl.getUniformLocation(prog, "u_amp");
      uMask = gl.getUniformLocation(prog, "u_mask");
      uOpacity = gl.getUniformLocation(prog, "u_opacity");
      uMode = gl.getUniformLocation(prog, "u_mode");
      uDetail = gl.getUniformLocation(prog, "u_detail");

      nodeBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, nodeBuf);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.nodes, gl.STATIC_DRAW);
      lineBuf = gl.createBuffer();
      triBuf = gl.createBuffer();

      // VAO خاص بنا (WebGL2) — ونرفع مخازن العناصر داخله كي لا نلوّث ربط VAO نشط لـMapLibre
      const gl2 = gl as WebGL2RenderingContext;
      if (typeof gl2.createVertexArray === "function") {
        vao = gl2.createVertexArray();
        gl2.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, nodeBuf);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.lineIdx, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.triIdx, gl.STATIC_DRAW);
        gl2.bindVertexArray(null);
      } else {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.lineIdx, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.triIdx, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      maskTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, maskTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buildMaskCanvas(polys, mesh.origin, mesh.extent));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);

      // حلقة التحريك: إطارات مستمرة ما دام النسيج ظاهراً؛ تتوقف بعد عتبة التلاشي (أداء عملي)
      const tick = (): void => {
        rafId = requestAnimationFrame(tick);
        const mm = map;
        if (mm && mm.getZoom() < FADE_END_ZOOM) mm.triggerRepaint();
      };
      rafId = requestAnimationFrame(tick);
    },

    onRemove(_m: GLMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      const gl2 = gl as WebGL2RenderingContext;
      if (vao && typeof gl2.deleteVertexArray === "function") gl2.deleteVertexArray(vao);
      if (nodeBuf) gl.deleteBuffer(nodeBuf);
      if (lineBuf) gl.deleteBuffer(lineBuf);
      if (triBuf) gl.deleteBuffer(triBuf);
      if (maskTex) gl.deleteTexture(maskTex);
      if (program) gl.deleteProgram(program);
      vao = null;
      nodeBuf = null;
      lineBuf = null;
      triBuf = null;
      maskTex = null;
      program = null;
      map = null;
    },

    render(gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput): void {
      if (!program || !nodeBuf || !lineBuf || !triBuf || !maskTex || !map) return;
      const zoom = map.getZoom();
      const op = zoomOpacity(zoom);
      if (op <= 0.004) return; // متلاشٍ — لا رسم

      gl.useProgram(program);
      gl.uniformMatrix4fv(uMatrix, false, options.defaultProjectionData.mainMatrix as Float32Array);
      gl.uniform1f(uTime, (performance.now() - t0) / 1000);
      gl.uniform2f(uOrigin, mesh.origin[0], mesh.origin[1]);
      gl.uniform2f(uExtent, mesh.extent[0], mesh.extent[1]);
      gl.uniform1f(uAmp, mesh.cell * 1.5); // سعة بمقياس الخلية الشعرية — تموّج ظاهر ناعم بلا تمزّق
      gl.uniform1f(uOpacity, op);
      // عامل التفصيل: عند الإبعاد تخفّ الخطوط أكثر (نينوى مظلَّلة بخفّة) وتكتمل العين القريبة
      gl.uniform1f(uDetail, Math.min(1, Math.max(0.3, (zoom - 5.5) / 3)));

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, maskTex);
      gl.uniform1i(uMask, 0);

      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      const gl2 = gl as WebGL2RenderingContext;
      const useVao = vao !== null && typeof gl2.bindVertexArray === "function";
      if (useVao) gl2.bindVertexArray(vao);
      else {
        gl.bindBuffer(gl.ARRAY_BUFFER, nodeBuf);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      }
      const IDX = idxType === "uint32" ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;

      gl.uniform1i(uMode, 0); // سطح الارتفاع الخافت
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triBuf);
      gl.drawElements(gl.TRIANGLES, mesh.triIdx.length, IDX, 0);

      gl.uniform1i(uMode, 1); // الشبكة الشعرية
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineBuf);
      gl.drawElements(gl.LINES, mesh.lineIdx.length, IDX, 0);

      if (useVao) gl2.bindVertexArray(null);
      else gl.disableVertexAttribArray(aPos);
    },
  };
}
