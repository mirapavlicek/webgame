// Procedural building shader — renders an isometric-looking building into
// a quad with two visible faces (front + side) plus a roof. Windows, accents
// and neon glow are all generated from the fragment shader.
//
// The approach:
//   - Draw a vertical "face" and use UV.x<0.5 = front face, UV.x>=0.5 = side face
//   - UV.y = 0 at base, 1 at roof
//   - Use a grid function to tile windows; seed distorts position per building
//   - Output emissive color for lit windows (for bloom/glow in compositing)

export const BUILDING_VERT = /* glsl */ `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;
uniform mat3 translationMatrix;

varying vec2 vUV;

void main() {
  vUV = aTextureCoord;
  gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
}
`;

export const BUILDING_FRAG = /* glsl */ `
precision mediump float;

varying vec2 vUV;

uniform vec3  uPalette;      // base facade
uniform vec3  uAccent;       // accent/trim
uniform float uSeed;         // 0..1 per-building seed
uniform float uBaseHeight;   // 1..6 multiplier
uniform float uWidthMul;
uniform float uWindowDensity; // 0..1
uniform float uWindowSize;    // 0.05..0.20
uniform float uNeonChance;    // 0..1
uniform float uNightFactor;   // 0 = day, 1 = night (for window glow)
uniform float uRoofStyle;     // 0 flat, 1 pitched, 2 spire

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453 + uSeed * 97.1);
}

// Single window: returns 1 inside window rect, 0 outside
float windowCell(vec2 uv, vec2 gridSize, float winSize) {
  vec2 cell = floor(uv * gridSize);
  vec2 local = fract(uv * gridSize);
  float h = hash(cell + 0.17);
  // Window if this cell exists (density threshold)
  if (h > uWindowDensity) return 0.0;
  // Window rect inside cell
  float half_w = winSize * 0.5;
  vec2 d = abs(local - vec2(0.5));
  if (d.x < half_w && d.y < half_w * 1.5) return 1.0;
  return 0.0;
}

// Glow color from a lit window, with optional neon
vec3 windowColor(vec2 uv, vec2 gridSize) {
  vec2 cell = floor(uv * gridSize);
  float h = hash(cell + 3.7);
  float neon = hash(cell + 11.3) < uNeonChance ? 1.0 : 0.0;
  float brightness = 0.4 + 0.6 * h;
  if (neon > 0.5) {
    // neon palette — cyan, magenta, amber
    float sel = hash(cell + 4.4);
    if (sel < 0.34)      return vec3(0.2, 1.0, 1.0) * (1.0 + 0.3 * sin(uSeed * 9.0 + cell.x * 1.7));
    else if (sel < 0.67) return vec3(1.0, 0.3, 0.95);
    else                 return vec3(1.0, 0.85, 0.3);
  }
  // warm interior light
  return vec3(1.0, 0.85, 0.55) * brightness;
}

void main() {
  // Determine face: left half = front, right half = side
  float faceId = vUV.x < 0.5 ? 0.0 : 1.0;
  vec2 faceUV = vec2(fract(vUV.x * 2.0), vUV.y);

  // Face darkening: side face is slightly darker (sun direction from the left)
  float faceShade = faceId < 0.5 ? 1.0 : 0.72;

  // Column fade at top & bottom for subtle shading
  float verticalShade = 1.0 - smoothstep(0.9, 1.0, faceUV.y) * 0.25;

  // Window grid — more rows the taller the building
  float rows = floor(uBaseHeight * 4.0 + 1.0);
  float cols = floor(3.0 * uWidthMul + 1.0);
  vec2 grid = vec2(cols, rows);

  float win = windowCell(faceUV, grid, uWindowSize);

  // Base facade color with subtle stripe pattern
  vec3 facade = uPalette * faceShade * verticalShade;
  float stripe = 0.05 * sin(faceUV.y * rows * 3.14159 * 2.0);
  facade += vec3(stripe);

  // Accent trim at bottom (ground floor) and top (roof edge)
  if (faceUV.y < 0.08 || faceUV.y > 0.95) facade = mix(facade, uAccent, 0.6);

  // Window color mix — at night windows glow, day they're dark glass
  vec3 winCol = windowColor(faceUV, grid);
  vec3 windowDay = vec3(0.08, 0.10, 0.14);
  vec3 windowActual = mix(windowDay, winCol, uNightFactor);

  vec3 col = mix(facade, windowActual, win);

  // Emissive addition for bloom — only when window is lit at night
  if (win > 0.5 && uNightFactor > 0.1) {
    col += winCol * uNightFactor * 0.6;
  }

  // Subtle vignette from building edges for soft depth
  float edgeFade = smoothstep(0.0, 0.05, vUV.x) * smoothstep(0.0, 0.05, 1.0 - vUV.x);
  col *= 0.85 + 0.15 * edgeFade;

  gl_FragColor = vec4(col, 1.0);
}
`;
