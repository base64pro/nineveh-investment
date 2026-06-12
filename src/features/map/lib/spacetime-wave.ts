// م7.6 · نسيج الزمكان الحي v2 — «مياه حية / تضاريس هولوكرامية» بثلاث طبقات من مظلّل واحد:
// (0) سطح مائي شفّاف بتدرّج ارتفاع + خطوط كنتور طبوغرافية تتدفق عبر الحقل،
// (1) شبكة سلكية تنحني بالموجة وتتوهّج قممها وتلمع ذراها لمعان الماء،
// (2) عقد ضوئية نابضة عند التقاطعات تكبر وتسطع مع القمم وجبهة المسح.
// الحركة: Vertex Shader يزيح العقد «عمودياً» (محور Y الميركاتوري) بثلاث أوكتافات Simplex Noise
// بسرعات واتجاهات متباينة + جبهة مسح قطرية دورية — الزمن يتقدّم كل إطار (rAF + triggerRepaint)
// فالموجة لا نهائية لا تتوقّف ولا تنكسر (حقل متّصل)، والقصّ على نينوى بقناع ألفا ناعم لا يقطع التدفّق.
// CustomLayerInterface = نفس خط WebGL الذي تغلّفه Three.js/ShaderMaterial — ضمن الحزمة الثابتة.

import { MercatorCoordinate } from "maplibre-gl";
import type { CustomLayerInterface, CustomRenderMethodInput, Map as GLMap } from "maplibre-gl";
import type { FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";

export const SPACETIME_WAVE_LAYER = "spacetime-wave";

// حضور أقوى (مبهر) مع تخافت بالزوم حفاظاً على قراءة القطع عند التقريب
const OPACITY_STOPS: ReadonlyArray<readonly [number, number]> = [
  [5, 0.42],
  [8, 0.6],
  [11, 0.45],
  [13, 0.26],
  [15, 0.12],
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
uniform float u_detail;
varying float v_wave;
varying float v_sweep;
varying vec2 v_uv;
${SNOISE_GLSL}
void main() {
  v_uv = (a_pos - u_origin) / u_extent;
  vec2 p = (a_pos - u_origin) / u_extent.x; // مقياس موحّد = موجات متجانسة الاتجاهات
  float t = u_time;
  // ثلاث أوكتافات بسرعات واتجاهات متباينة — تداخل حيّ يتجدّد باستمرار (ماء حي)
  float h = snoise(p * 7.0  + vec2( 0.30,  0.20) * t) * 0.55
          + snoise(p * 16.0 + vec2(-0.42,  0.28) * t) * 0.30
          + snoise(p * 33.0 + vec2( 0.26, -0.55) * t) * 0.15;
  v_wave = h;
  // جبهة مسح هولوكرامية قطرية تعبر نينوى دورياً (~9 ثوانٍ) — نبض الموشن الواضح
  float ph = fract(dot(p, vec2(0.8206, 0.5715)) * 0.55 - t * 0.11);
  float sd = (ph - 0.5) * 13.0; // لا pow بأساس سالب (سلوك غير معرّف → NaN على بعض المعالجات)
  v_sweep = exp(-sd * sd);
  // الإزاحة «العمودية» للمشهد العلوي: محور Y الميركاتوري + رجفة X مائية طفيفة
  vec2 disp = vec2(0.22, 1.0) * (h * u_amp);
  gl_Position = u_matrix * vec4(a_pos + disp, 0.0, 1.0);
  gl_PointSize = clamp(2.0 + 3.6 * (0.5 + 0.5 * h) + 5.0 * v_sweep, 2.0, 9.0) * mix(0.5, 1.0, u_detail);
}
`;

const FRAGMENT_SRC = /* glsl */ `
precision mediump float;
uniform sampler2D u_mask;
uniform float u_opacity;
uniform highp float u_time; // مشترك مع الرأسي — وجوب تطابق الدقّة وإلا فشل الربط
uniform highp float u_detail; // مشترك مع الرأسي (نفس قاعدة الدقّة)
uniform int u_mode; // 0 سطح مائي · 1 شبكة سلكية · 2 عقد ضوئية
varying float v_wave;
varying float v_sweep;
varying vec2 v_uv;

// تدرّج تضاريس هولوكرامي: أزرق عميق ← ثلجي معتمد rgb(196,219,247) ← أبيض القمم
vec3 ramp(float c) {
  vec3 deep = vec3(0.16, 0.30, 0.52);
  vec3 ice  = vec3(0.769, 0.859, 0.969);
  vec3 peak = vec3(1.0, 1.0, 1.0);
  if (c < 0.62) return mix(deep, ice, c / 0.62);
  return mix(ice, peak, (c - 0.62) / 0.38);
}

void main() {
  float m = texture2D(u_mask, v_uv).a; // قناع نينوى الناعم — يقصّ الظهور لا الحقل
  if (m < 0.004) discard;
  float c01 = clamp(0.5 + 0.5 * v_wave, 0.0, 1.0);
  float spec = pow(c01, 8.0); // لمعان ذرى الماء
  vec3 col;
  float a;
  if (u_mode == 0) {
    // سطح مائي: تدرّج ارتفاع + خطوط كنتور طبوغرافية تتدفق صعوداً عبر الحقل
    float iso = abs(fract(c01 * 6.0 - u_time * 0.16) - 0.5);
    float contour = smoothstep(0.085, 0.02, iso);
    col = ramp(c01) + vec3(0.30) * v_sweep + vec3(0.22) * contour;
    a = u_opacity * m * (0.045 + 0.14 * c01 + 0.10 * v_sweep + 0.12 * contour);
  } else if (u_mode == 1) {
    // الشبكة: القمم تتوهّج والذرى تلمع وجبهة المسح تشعلها لحظياً
    col = ramp(c01) * (0.9 + 0.3 * c01) + vec3(0.40) * v_sweep + vec3(0.55) * spec;
    a = u_opacity * m * clamp(0.16 + 0.62 * c01 + 0.50 * v_sweep + 0.55 * spec, 0.0, 1.0) * (0.55 + 0.45 * u_detail);
  } else {
    // عقد ضوئية: قرص ناعم متوهّج يتنفّس مع الموجة
    vec2 d = gl_PointCoord - vec2(0.5);
    float disk = exp(-dot(d, d) * 14.0) - 0.02;
    if (disk <= 0.0) discard;
    col = ramp(c01) + vec3(0.45) * v_sweep + vec3(0.5) * spec;
    a = u_opacity * m * disk * clamp(0.30 + 0.80 * c01 + 0.80 * v_sweep + spec, 0.0, 1.4) * u_detail;
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
  nodes: Float32Array; // عقد الشبكة (COLS+1)×(ROWS+1)
  nodeCount: number;
  lineIdx: Uint16Array | Uint32Array;
  triIdx: Uint16Array | Uint32Array;
  origin: [number, number];
  extent: [number, number];
  cell: number;
}

// شبكة عقد مفهرسة في فضاء ميركاتور: مثلّثات للسطح + أزواج للخطوط + العقد نفسها كنقاط
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
  const COLS = 120;
  const cell = extX / COLS;
  const ROWS = Math.min(170, Math.max(8, Math.round(extY / cell)));
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

      // حلقة التحريك المضمونة: rAF يطلب إطاراً جديداً دوماً (يتوقّف تلقائياً بخفاء التبويب)
      const tick = (): void => {
        rafId = requestAnimationFrame(tick);
        map?.triggerRepaint();
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
      gl.useProgram(program);

      gl.uniformMatrix4fv(uMatrix, false, options.defaultProjectionData.mainMatrix as Float32Array);
      gl.uniform1f(uTime, (performance.now() - t0) / 1000);
      gl.uniform2f(uOrigin, mesh.origin[0], mesh.origin[1]);
      gl.uniform2f(uExtent, mesh.extent[0], mesh.extent[1]);
      gl.uniform1f(uAmp, mesh.cell * 1.35); // إزاحة بمقياس الخلية — موجة مرئية بوضوح بلا تمزّق
      const zoom = map.getZoom();
      gl.uniform1f(uOpacity, zoomOpacity(zoom));
      // عامل التفصيل: عند الإبعاد تخفّ الخطوط والعقد (تبقى نينوى «مظلَّلة بخفّة») وعند الاقتراب يكتمل الثراء
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

      gl.uniform1i(uMode, 0); // السطح المائي
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triBuf);
      gl.drawElements(gl.TRIANGLES, mesh.triIdx.length, IDX, 0);

      gl.uniform1i(uMode, 1); // الشبكة السلكية
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineBuf);
      gl.drawElements(gl.LINES, mesh.lineIdx.length, IDX, 0);

      gl.uniform1i(uMode, 2); // العقد الضوئية
      gl.drawArrays(gl.POINTS, 0, mesh.nodeCount);

      if (useVao) gl2.bindVertexArray(null);
      else gl.disableVertexAttribArray(aPos);

      map.triggerRepaint(); // ضمان مزدوج لاستمرار الحركة
    },
  };
}
