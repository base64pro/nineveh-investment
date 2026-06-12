// م7.6 · نسيج الزمكان الحي (موجات): طبقة MapLibre مخصّصة (CustomLayerInterface = نفس خط WebGL
// الذي تغلّفه Three.js/ShaderMaterial — دون مكتبة جديدة، التزاماً بالحزمة الثابتة).
// المبدأ المطلوب حرفياً: Vertex Shader يزيح نقاط الشبكة «عمودياً» (محور Y لمشهدنا العلوي = شمال/جنوب
// ميركاتور) بدالّة Simplex Noise ثنائية مع متغيّر زمن يتقدّم كل إطار (triggerRepaint = حلقة التحريك)،
// فيتموّج النسيج كسطح بحيرة هادئة؛ الحقل متّصل رياضياً فلا ينكسر، والقصّ على نينوى بقناع ألفا ناعم
// لا يقطع التدفّق — والقمم تتوهّج (مسح جيولوجي هولوكرامي حي).

import { MercatorCoordinate } from "maplibre-gl";
import type { CustomLayerInterface, CustomRenderMethodInput, Map as GLMap } from "maplibre-gl";
import type { FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";

export const SPACETIME_WAVE_LAYER = "spacetime-wave";

// نفس منحنى التخافت بالزوم المعتمد لطبقة النسيج السابقة (يُحسب كل إطار)
const OPACITY_STOPS: ReadonlyArray<readonly [number, number]> = [
  [5, 0.58],
  [8, 0.42],
  [11, 0.24],
  [13, 0.13],
  [15, 0.06],
];

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
  vec2 p = (a_pos - u_origin) / u_extent.x; // مقياس موحّد للمحورين = موجات متجانسة الاتجاهات
  float t = u_time;
  // ثلاث أوكتافات بطيئة بانسياب مختلف الاتجاه — ارتفاع الموجة h في [-1..1] متّصل عبر كامل الحقل
  float h = snoise(p * 9.0  + vec2(t * 0.040, t * 0.026)) * 0.62
          + snoise(p * 21.0 + vec2(-t * 0.052, t * 0.038)) * 0.28
          + snoise(p * 44.0 + vec2(t * 0.030, -t * 0.060)) * 0.10;
  v_wave = h;
  // الإزاحة «العمودية» لمشهدنا العلوي: محور Y الميركاتوري (+ رجفة X طفيفة للإحساس المائي)
  vec2 disp = vec2(0.18, 1.0) * (h * u_amp);
  gl_Position = u_matrix * vec4(a_pos + disp, 0.0, 1.0);
}
`;

const FRAGMENT_SRC = /* glsl */ `
precision mediump float;
uniform sampler2D u_mask;
uniform float u_opacity;
varying float v_wave;
varying vec2 v_uv;
void main() {
  float m = texture2D(u_mask, v_uv).a;          // قناع نينوى (حافة ناعمة) — يقصّ الظهور لا الحقل
  float c = smoothstep(0.08, 0.92, 0.5 + 0.5 * v_wave); // قمّة الموجة 0..1
  float a = u_opacity * m * (0.40 + 0.60 * c);
  vec3 ice = vec3(0.769, 0.859, 0.969);          // rgb(196,219,247) المعتمد
  vec3 col = ice * (0.82 + 0.38 * c);            // القمم أنصع — توهّج هولوكرامي
  gl_FragColor = vec4(col * a, a);               // premultiplied
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
  positions: Float32Array;
  vertexCount: number;
  origin: [number, number];
  extent: [number, number];
  cell: number;
}

// شبكة خطوط مقسّمة (كل ضلع بطول خلية) في فضاء ميركاتور — كثافة كافية ليَنحني الخط بسلاسة موجة
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

  const margin = (maxX - minX) * 0.03; // هامش يحتضن نعومة حافة القناع
  minX -= margin;
  minY -= margin;
  maxX += margin;
  maxY += margin;

  const extX = maxX - minX;
  const extY = maxY - minY;
  const COLS = 110;
  const cell = extX / COLS;
  const ROWS = Math.max(8, Math.round(extY / cell));

  const pts: number[] = [];
  for (let j = 0; j <= ROWS; j++) {
    const y = minY + (extY * j) / ROWS;
    for (let i = 0; i < COLS; i++) {
      const x0 = minX + cell * i;
      pts.push(x0, y, x0 + cell, y);
    }
  }
  const cellY = extY / ROWS;
  for (let i = 0; i <= COLS; i++) {
    const x = minX + cell * i;
    for (let j = 0; j < ROWS; j++) {
      const y0 = minY + cellY * j;
      pts.push(x, y0, x, y0 + cellY);
    }
  }
  return {
    positions: new Float32Array(pts),
    vertexCount: pts.length / 2,
    origin: [minX, minY],
    extent: [extX, extY],
    cell,
  };
}

// قناع نينوى: مضلّع المحافظة أبيض على شفاف بضباب 3px (حافة متلاشية) — يُرفع كـtexture ألفا
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

  let map: GLMap | null = null;
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let maskTex: WebGLTexture | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let aPos = 0;
  let uMatrix: WebGLUniformLocation | null = null;
  let uTime: WebGLUniformLocation | null = null;
  let uOrigin: WebGLUniformLocation | null = null;
  let uExtent: WebGLUniformLocation | null = null;
  let uAmp: WebGLUniformLocation | null = null;
  let uMask: WebGLUniformLocation | null = null;
  let uOpacity: WebGLUniformLocation | null = null;
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

      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);

      // VAO خاص بنا (WebGL2) كي لا نلوّث حالة سمات MapLibre
      const gl2 = gl as WebGL2RenderingContext;
      if (typeof gl2.createVertexArray === "function") {
        vao = gl2.createVertexArray();
        gl2.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        gl2.bindVertexArray(null);
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
    },

    onRemove(_m: GLMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
      const gl2 = gl as WebGL2RenderingContext;
      if (vao && typeof gl2.deleteVertexArray === "function") gl2.deleteVertexArray(vao);
      if (buffer) gl.deleteBuffer(buffer);
      if (maskTex) gl.deleteTexture(maskTex);
      if (program) gl.deleteProgram(program);
      vao = null;
      buffer = null;
      maskTex = null;
      program = null;
      map = null;
    },

    render(gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput): void {
      if (!program || !buffer || !maskTex || !map) return;
      gl.useProgram(program);

      gl.uniformMatrix4fv(uMatrix, false, options.defaultProjectionData.mainMatrix as Float32Array);
      gl.uniform1f(uTime, (performance.now() - t0) / 1000);
      gl.uniform2f(uOrigin, mesh.origin[0], mesh.origin[1]);
      gl.uniform2f(uExtent, mesh.extent[0], mesh.extent[1]);
      gl.uniform1f(uAmp, mesh.cell * 0.34); // سعة < نصف الخلية — انحناء واضح بلا تمزّق
      gl.uniform1f(uOpacity, zoomOpacity(map.getZoom()));

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, maskTex);
      gl.uniform1i(uMask, 0);

      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      const gl2 = gl as WebGL2RenderingContext;
      const useVao = vao && typeof gl2.bindVertexArray === "function";
      if (useVao) gl2.bindVertexArray(vao);
      else {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      }
      gl.drawArrays(gl.LINES, 0, mesh.vertexCount);
      if (useVao) gl2.bindVertexArray(null);
      else gl.disableVertexAttribArray(aPos);

      map.triggerRepaint(); // حلقة التحريك: زمن يتقدّم كل إطار — الموجة لا تتوقّف
    },
  };
}
