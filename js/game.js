'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  font: 'Fredoka One',   // used only for hint label + celebration text

  // Path coordinate space for each digit: 100 wide × 140 tall
  // Scale is computed so the digit(s) fill this fraction of the screen.
  pathAvailW: 0.82,      // max fraction of canvas width  used by all digits
  pathAvailH: 0.60,      // max fraction of canvas height used by all digits

  // Visual stroke widths as multiples of scale (path units → canvas pixels)
  strokeOuter: 9,        // colored outline stroke width (path units)
  strokeInner: 5,        // white fill stroke width (path units)

  // Spacing between dots along the path (path units — same space as strokeOuter/strokeInner)
  dotSpacing: 10,

  // Visual radius of each trace dot (px) — small enough to fit inside the stroke
  dotRadius: 4,

  // Distance from touch/mouse point that clears a dot (px)
  touchRadius: 42,

  // Fraction of dots that must be cleared to complete a number
  completionThreshold: 1.00,

  // How long the celebration screen plays (ms)
  celebrationDuration: 1800,

  // Maximum recent touch points kept for the trail
  trailLength: 28,

  // Cycling color palette for numbers — each successive number gets the next color
  numColorPalette: [
    { stroke: '#e74c3c', fill: '#ffffff' },  // red
    { stroke: '#e67e22', fill: '#ffffff' },  // orange
    { stroke: '#27ae60', fill: '#ffffff' },  // green
    { stroke: '#8e44ad', fill: '#ffffff' },  // purple
    { stroke: '#2980b9', fill: '#ffffff' },  // blue
    { stroke: '#16a085', fill: '#ffffff' },  // teal
    { stroke: '#c0392b', fill: '#ffffff' },  // crimson
    { stroke: '#d35400', fill: '#ffffff' },  // dark orange
  ],

  colors: {
    bgTop:           '#4facfe',
    bgBottom:        '#00c9ff',
    numShadow:       'rgba(0, 0, 0, 0.25)',
    dot:             '#cccccc',              // light gray dots
    trail:           'rgba(255, 255, 255, 0.38)',
    progressBg:      'rgba(255, 255, 255, 0.3)',
    progressFill:    '#2ecc71',
    hintLabel:       'rgba(255, 255, 255, 0.92)',
    celebrationText: '#ffffff',
  },

  celebrationMessages: ['Great job!', 'Amazing!', 'You did it!', 'Awesome!', 'Wonderful!'],
  particleColors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff922b', '#cc5de8', '#f06595'],
};

// ─────────────────────────────────────────────────────────────────────────────
// GAME MODES
// Add new modes here. `enabled: false` greys out the button and blocks switching.
// ─────────────────────────────────────────────────────────────────────────────

const GAME_MODES = {
  numbers:  { label: 'Numbers',  icon: '123', enabled: true  },
  alphabet: { label: 'Alphabet', icon: 'ABC', enabled: true },
};

// Preload the completion sound. encodeURI handles the space in the folder name.
const sparkleSound = new Audio(encodeURI('Mixkit Sound Files/mixkit-fairy-arcade-sparkle-866.wav'));
sparkleSound.preload = 'auto';
const clickSound = new Audio(encodeURI('Mixkit Sound Files/mixkit-select-click-1109.wav'));
clickSound.preload = 'auto';

// iOS Safari blocks audio unless it is first triggered inside a direct user-gesture
// event (touchstart qualifies; touchmove does not).  Prime the element silently on
// the very first touch so it is unlocked before celebrate() ever calls play().
document.addEventListener('touchstart', function unlockAudio() {
  // Play then synchronously pause — unlocks the audio element on iOS Safari
  // without any audible output or async race with celebrate().
  sparkleSound.volume = 0;
  const p = sparkleSound.play();
  sparkleSound.pause();
  sparkleSound.currentTime = 0;
  sparkleSound.volume = 1;
  if (p) p.catch(() => {});
  clickSound.volume = 0;
  const p2 = clickSound.play();
  clickSound.pause();
  clickSound.currentTime = 0;
  clickSound.volume = 1;
  if (p2) p2.catch(() => {});
}, { once: true, passive: true });

// ─────────────────────────────────────────────────────────────────────────────
// DIGIT CENTERLINE PATHS
// Each digit is defined in a 100 × 140 coordinate space (origin = top-left).
// Commands: M (moveto), L (lineto), C (cubic bezier: x1 y1 x2 y2 x y)
// Each array entry is one continuous sub-path.  A digit may have multiple.
// ─────────────────────────────────────────────────────────────────────────────

const DIGIT_PATHS = {
  0: [[
    { t: 'M', x: 50,  y: 10  },
    { t: 'C', x1: 85,  y1: 10,  x2: 92,  y2: 40,  x: 92, y: 70  },
    { t: 'C', x1: 92,  y1: 102, x2: 85,  y2: 130, x: 50, y: 130 },
    { t: 'C', x1: 15,  y1: 130, x2: 8,   y2: 102, x: 8,  y: 70  },
    { t: 'C', x1: 8,   y1: 40,  x2: 15,  y2: 10,  x: 50, y: 10  },
  ]],

  1: [
    [
      { t: 'M', x: 30, y: 30 },
      { t: 'L', x: 50, y: 14 },
    ],
    [
      { t: 'M', x: 50, y: 14  },
      { t: 'L', x: 50, y: 126 },
    ],
  ],

  2: [[
    { t: 'M', x: 16,  y: 46  },
    { t: 'C', x1: 14,  y1: 16,  x2: 54,  y2: 4,   x: 74, y: 18  },
    { t: 'C', x1: 90,  y1: 30,  x2: 84,  y2: 58,  x: 60, y: 76  },
    { t: 'C', x1: 38,  y1: 90,  x2: 12,  y2: 108, x: 12, y: 120 },
    { t: 'L', x: 84,  y: 120 },
  ]],

  3: [
    [
      { t: 'M', x: 16, y: 30  },
      { t: 'C', x1: 16, y1: 6,  x2: 86, y2: 6,  x: 82, y: 44 },
      { t: 'C', x1: 78, y1: 66, x2: 52, y2: 70, x: 52, y: 70 },
    ],
    [
      { t: 'M', x: 52, y: 70  },
      { t: 'C', x1: 52, y1: 70,  x2: 86, y2: 76,  x: 82, y: 106 },
      { t: 'C', x1: 78, y1: 134, x2: 16, y2: 134, x: 16, y: 112 },
    ],
  ],

  4: [
    [
      { t: 'M', x: 57, y: 12 },
      { t: 'L', x: 10, y: 90 },
      { t: 'L', x: 84, y: 90 },
    ],
    [
      { t: 'M', x: 57, y: 12  },
      { t: 'L', x: 57, y: 128 },
    ],
  ],

  5: [[
    { t: 'M', x: 80, y: 14 },
    { t: 'L', x: 16, y: 14 },
    { t: 'L', x: 16, y: 66 },
    { t: 'C', x1: 38, y1: 56,  x2: 80, y2: 64, x: 80, y: 96  },
    { t: 'C', x1: 80, y1: 128, x2: 36, y2: 140, x: 14, y: 122 },
  ]],

  6: [[
    { t: 'M', x: 74, y: 18  },
    { t: 'C', x1: 50, y1: 4,   x2: 10, y2: 24, x: 12, y: 76  },
    { t: 'C', x1: 14, y1: 118, x2: 38, y2: 140, x: 64, y: 134 },
    { t: 'C', x1: 88, y1: 126, x2: 90, y2: 92, x: 72, y: 76  },
    { t: 'C', x1: 56, y1: 60,  x2: 20, y2: 64, x: 14, y: 76  },
  ]],

  7: [[
    { t: 'M', x: 14, y: 16 },
    { t: 'L', x: 82, y: 16 },
    { t: 'L', x: 38, y: 126 },
  ]],

  8: [
    [
      { t: 'M', x: 50, y: 70 },
      { t: 'C', x1: 80, y1: 62, x2: 84, y2: 38, x: 66, y: 22 },
      { t: 'C', x1: 50, y1: 6,  x2: 18, y2: 12, x: 18, y: 38 },
      { t: 'C', x1: 18, y1: 62, x2: 50, y2: 70, x: 50, y: 70 },
    ],
    [
      { t: 'M', x: 50, y: 70  },
      { t: 'C', x1: 82, y1: 78,  x2: 84, y2: 108, x: 66, y: 122 },
      { t: 'C', x1: 50, y1: 136, x2: 18, y2: 130, x: 18, y: 104 },
      { t: 'C', x1: 18, y1: 80,  x2: 50, y2: 70,  x: 50, y: 70  },
    ],
  ],

  9: [[
    { t: 'M', x: 80, y: 58  },
    { t: 'C', x1: 82, y1: 28,  x2: 58, y2: 10, x: 38, y: 14  },
    { t: 'C', x1: 14, y1: 20,  x2: 12, y2: 54, x: 32, y: 68  },
    { t: 'C', x1: 50, y1: 80,  x2: 82, y2: 72, x: 80, y: 58  },
    { t: 'L', x: 80, y: 128 },
  ]],
};

// ─────────────────────────────────────────────────────────────────────────────
// PATH UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function bezierPoint(p0, p1, p2, p3, t) {
  const m = 1 - t;
  return {
    x: m*m*m*p0.x + 3*m*m*t*p1.x + 3*m*t*t*p2.x + t*t*t*p3.x,
    y: m*m*m*p0.y + 3*m*m*t*p1.y + 3*m*t*t*p2.y + t*t*t*p3.y,
  };
}

/**
 * Expand one sub-path (array of M/L/C commands) into a dense polyline
 * in canvas-pixel coordinates, given a uniform scale and (ox, oy) offset.
 */
function expandSubpath(cmds, scale, ox, oy) {
  const pts = [];
  let cx = 0, cy = 0;

  for (const cmd of cmds) {
    if (cmd.t === 'M') {
      cx = cmd.x; cy = cmd.y;
      pts.push({ x: ox + cx * scale, y: oy + cy * scale });

    } else if (cmd.t === 'L') {
      const steps = Math.max(2, Math.ceil(Math.hypot(cmd.x - cx, cmd.y - cy) * scale / 2));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        pts.push({
          x: ox + (cx + (cmd.x - cx) * t) * scale,
          y: oy + (cy + (cmd.y - cy) * t) * scale,
        });
      }
      cx = cmd.x; cy = cmd.y;

    } else if (cmd.t === 'C') {
      const p0 = { x: cx,     y: cy     };
      const p1 = { x: cmd.x1, y: cmd.y1 };
      const p2 = { x: cmd.x2, y: cmd.y2 };
      const p3 = { x: cmd.x,  y: cmd.y  };
      const steps = 60;
      for (let i = 1; i <= steps; i++) {
        const bp = bezierPoint(p0, p1, p2, p3, i / steps);
        pts.push({ x: ox + bp.x * scale, y: oy + bp.y * scale });
      }
      cx = p3.x; cy = p3.y;
    }
  }
  return pts;
}

/**
 * Sample evenly-spaced points along a dense polyline.
 * Returns canvas-space {x, y} points.
 */
function sampleEvenSpacing(pts, spacing) {
  if (pts.length < 2) return pts.slice();

  // Build cumulative arc lengths
  const arc = [0];
  for (let i = 1; i < pts.length; i++) {
    arc.push(arc[i - 1] + Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y));
  }

  const total  = arc[arc.length - 1];
  const result = [];
  let   j      = 0;

  for (let d = spacing * 0.5; d < total; d += spacing) {
    while (j < arc.length - 1 && arc[j + 1] < d) j++;
    if (j >= pts.length - 1) break;
    const t  = (d - arc[j]) / (arc[j + 1] - arc[j]);
    result.push({
      x: pts[j].x + (pts[j + 1].x - pts[j].x) * t,
      y: pts[j].y + (pts[j + 1].y - pts[j].y) * t,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT  —  maps digit path space to canvas pixels
// Handles any number of digits (1, 2, 3, …), centered on screen.
// ─────────────────────────────────────────────────────────────────────────────

const DIGIT_GAP = 14; // gap between digits in path units

function getLayout(number) {
  const label     = String(number);
  const n         = label.length;
  const pathW     = n * 100 + (n - 1) * DIGIT_GAP;
  const pathH     = 140;
  const availW    = cw * CONFIG.pathAvailW;
  const availH    = ch * CONFIG.pathAvailH;
  const scale     = Math.min(availW / pathW, availH / pathH);
  const totalW    = pathW * scale;
  const totalH    = pathH * scale;
  return {
    scale,
    ox: (cw - totalW) / 2,              // x-start of first digit
    oy: (ch - totalH) / 2,              // y-start (top) of all digits
  };
}

/** Returns the (ox, oy) offset for digit at position i within the laid-out number. */
function digitOffset(layout, i) {
  return {
    ox: layout.ox + i * (100 + DIGIT_GAP) * layout.scale,
    oy: layout.oy,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS SETUP
// ─────────────────────────────────────────────────────────────────────────────

const DPR    = window.devicePixelRatio || 1;
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

let cw = 0;
let ch = 0;

function resizeCanvas() {
  const modeBarH = document.getElementById('mode-bar')?.offsetHeight ?? 58;
  cw = window.innerWidth;
  ch = window.innerHeight - modeBarH;
  canvas.style.width  = cw + 'px';
  canvas.style.height = ch + 'px';
  canvas.width  = Math.round(cw * DPR);
  canvas.height = Math.round(ch * DPR);
  bgCache = null;
  abcBgCache = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME STATE
// ─────────────────────────────────────────────────────────────────────────────

const state = {
  activeMode:       'numbers',
  currentNumber:    1,
  dots:             [],
  digitDotGroups:   [],          // dots grouped by digit index, for the guide arrows
  phase:            'tracing',   // 'tracing' | 'celebrating'
  celebrationStart: 0,
  celebrationMsg:   '',
  particles:        [],
  trail:            [],
  isPointerDown:    false,
  numColor:         null,
  showHint:         true,

  // ── Alphabet mode ──
  abc: {
    wordOrder:    [],   // shuffled indices into ALPHABET_WORDS
    wordIdx:      0,    // current position in wordOrder
    phase:        'playing', // 'playing' | 'celebrating'
    celStart:     0,
    celMsg:       '',
    particles:    [],
    // Tile (draggable letter)
    tileX: 0, tileY: 0, tileW: 0, tileH: 0,
    tileHomeX: 0, tileHomeY: 0,
    dragging: false,
    dragOffX: 0, dragOffY: 0,
    // Drop zone (the blank box in the word)
    dropX: 0, dropY: 0, dropW: 0, dropH: 0,
    placed: false,  // letter successfully dropped
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DOT GENERATION  —  evenly spaced along each digit's centerline paths
// ─────────────────────────────────────────────────────────────────────────────

function generateDots(number) {
  const label  = String(number);
  const layout = getLayout(number);
  const dots   = [];

  for (let i = 0; i < label.length; i++) {
    const digit     = label[i];
    const subpaths  = DIGIT_PATHS[Number(digit)];
    const { ox, oy } = digitOffset(layout, i);

    for (const subpath of subpaths) {
      const dense     = expandSubpath(subpath, layout.scale, ox, oy);
      const spacingPx = Math.max(16, CONFIG.dotSpacing * layout.scale);
      const sampled   = sampleEvenSpacing(dense, spacingPx);
      for (const pt of sampled) {
        dots.push({ x: pt.x, y: pt.y, cleared: false, digitIndex: i });
      }
    }
  }

  return dots;
}

// ─────────────────────────────────────────────────────────────────────────────
// NUMBER RENDERING  —  draws the digit centerline paths as thick stroked paths
// ─────────────────────────────────────────────────────────────────────────────

function applySubpathToContext(context, cmds, scale, ox, oy) {
  let cx = 0, cy = 0;

  for (const cmd of cmds) {
    if (cmd.t === 'M') {
      context.moveTo(ox + cmd.x * scale, oy + cmd.y * scale);
      cx = cmd.x; cy = cmd.y;
    } else if (cmd.t === 'L') {
      context.lineTo(ox + cmd.x * scale, oy + cmd.y * scale);
      cx = cmd.x; cy = cmd.y;
    } else if (cmd.t === 'C') {
      context.bezierCurveTo(
        ox + cmd.x1 * scale, oy + cmd.y1 * scale,
        ox + cmd.x2 * scale, oy + cmd.y2 * scale,
        ox + cmd.x  * scale, oy + cmd.y  * scale,
      );
      cx = cmd.x; cy = cmd.y;
    }
  }
}

function drawNumber(context, number) {
  const label  = String(number);
  const layout = getLayout(number);
  const sw     = layout.scale * CONFIG.strokeOuter;
  const iw     = layout.scale * CONFIG.strokeInner;

  context.save();
  context.lineCap  = 'round';
  context.lineJoin = 'round';

  // Pass 1 — outer colored stroke (drawn slightly wider, acts as outline)
  context.shadowColor   = CONFIG.colors.numShadow;
  context.shadowBlur    = 14;
  context.shadowOffsetY = 5;
  context.strokeStyle   = state.numColor.stroke;
  context.lineWidth     = sw;

  for (let i = 0; i < label.length; i++) {
    const digit      = Number(label[i]);
    const subpaths   = DIGIT_PATHS[digit];
    const { ox, oy } = digitOffset(layout, i);

    for (const sub of subpaths) {
      context.beginPath();
      applySubpathToContext(context, sub, layout.scale, ox, oy);
      context.stroke();
    }
  }

  // Pass 2 — inner white stroke (sits on top of the orange outline)
  context.shadowColor   = 'transparent';
  context.shadowBlur    = 0;
  context.shadowOffsetY = 0;
  context.strokeStyle   = state.numColor.fill;
  context.lineWidth     = iw;

  for (let i = 0; i < label.length; i++) {
    const digit      = Number(label[i]);
    const subpaths   = DIGIT_PATHS[digit];
    const { ox, oy } = digitOffset(layout, i);

    for (const sub of subpaths) {
      context.beginPath();
      applySubpathToContext(context, sub, layout.scale, ox, oy);
      context.stroke();
    }
  }

  context.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTICLES
// ─────────────────────────────────────────────────────────────────────────────

function spawnParticles() {
  const ox = cw / 2;
  const oy = ch / 2;
  const colors = CONFIG.particleColors;
  for (let i = 0; i < 50; i++) {
    const angle = (Math.PI * 2 * i) / 50 + (Math.random() - 0.5) * 0.5;
    const speed = 4 + Math.random() * 10;
    state.particles.push({
      x:     ox,
      y:     oy,
      vx:    Math.cos(angle) * speed,
      vy:    Math.sin(angle) * speed - 3,
      r:     5 + Math.random() * 7,
      color: colors[Math.floor(Math.random() * colors.length)],
      life:  1.0,
      decay: 0.011 + Math.random() * 0.013,
    });
  }
}

function updateParticles() {
  for (const p of state.particles) {
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.22;
    p.vx *= 0.99;
    p.life -= p.decay;
  }
  state.particles = state.particles.filter(p => p.life > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDERING
// ─────────────────────────────────────────────────────────────────────────────

// ── Candy-store background (cached offscreen canvas) ────────────────────────

let bgCache = null;

function _rng(seed) {
  let s = seed | 0;
  return function () {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

function _star(g, cx, cy, r) {
  g.beginPath();
  for (let i = 0; i <= 10; i++) {
    const angle  = (i * Math.PI / 5) - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.42;
    i === 0
      ? g.moveTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius)
      : g.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  g.closePath();
}

function _drawGumballs(g, bx, by, bw, bh, colors, rng) {
  const ballR = Math.max(4, bw * 0.1);
  const cols  = Math.max(1, Math.floor(bw / (ballR * 2 + 3)));
  const rows  = Math.ceil(bh / (ballR * 2 + 3));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = bx + 3 + col * (bw / cols) + rng() * 3 - 1.5;
      const py = by + bh - (ballR + 3) - row * (ballR * 2 + 3);
      if (py < by + 4) continue;
      const bc = colors[Math.floor(rng() * colors.length)];
      g.beginPath();
      g.arc(px + ballR, py, ballR, 0, Math.PI * 2);
      g.fillStyle = bc;
      g.fill();
      g.beginPath();
      g.arc(px + ballR - ballR * 0.3, py - ballR * 0.28, ballR * 0.3, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0.68)';
      g.fill();
    }
  }
}

function _drawLollipops(g, bx, by, bw, bh, colors, rng) {
  const n     = Math.max(3, Math.floor(bw / 9));
  const headR = Math.max(6, bw * 0.11);
  for (let i = 0; i < n; i++) {
    const cx    = bx + 8 + (i / Math.max(1, n - 1)) * (bw - 16);
    const headY = by + headR + 6 + rng() * 8;
    const c1    = colors[Math.floor(rng() * colors.length)];
    const c2    = colors[Math.floor(rng() * colors.length)];
    g.save();
    g.strokeStyle = '#f5deb3';
    g.lineWidth   = 2.5;
    g.beginPath();
    g.moveTo(cx, headY);
    g.lineTo(cx, by + bh - 4);
    g.stroke();
    g.beginPath();
    g.arc(cx, headY, headR, 0, Math.PI * 2);
    g.fillStyle = c1;
    g.fill();
    for (let s = 0; s < 3; s++) {
      const a0 = (s / 3) * Math.PI * 2 - Math.PI / 2;
      g.beginPath();
      g.arc(cx, headY, headR * 0.55, a0, a0 + Math.PI * 0.65);
      g.strokeStyle = c2;
      g.lineWidth   = headR * 0.38;
      g.stroke();
    }
    g.beginPath();
    g.arc(cx - headR * 0.28, headY - headR * 0.28, headR * 0.22, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fill();
    g.restore();
  }
}

function _drawCandyCanes(g, bx, by, bw, bh, rng) {
  const n     = Math.max(3, Math.floor(bw / 9));
  const hookR = Math.max(5, bw * 0.09);
  for (let i = 0; i < n; i++) {
    const cx  = bx + 8 + (i / Math.max(1, n - 1)) * (bw - 16);
    const bot = by + bh - 4;
    const top = by + hookR * 2 + 6;
    const dir = i % 2 === 0 ? 1 : -1;
    for (let pass = 0; pass < 2; pass++) {
      g.save();
      g.lineCap     = 'round';
      g.lineWidth   = pass === 0 ? 6 : 3;
      g.strokeStyle = pass === 0 ? '#fff' : '#e74c3c';
      if (pass === 1) g.setLineDash([4, 4]);
      g.beginPath();
      g.moveTo(cx, bot);
      g.lineTo(cx, top);
      g.bezierCurveTo(cx, top - hookR, cx + dir * hookR * 2.2, top - hookR, cx + dir * hookR * 2.2, top + hookR * 0.4);
      g.stroke();
      g.restore();
    }
  }
}

function _drawJellyBeans(g, bx, by, bw, bh, colors, rng) {
  const beanW = Math.max(4, bw * 0.12);
  const beanH = beanW * 1.7;
  const cols  = Math.max(1, Math.floor(bw / (beanW + 3)));
  const rows  = Math.ceil(bh / (beanH + 2));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px    = bx + 3 + col * (bw / cols) + rng() * 4 - 2;
      const py    = by + bh - (beanH + 2) - row * (beanH + 2);
      if (py < by + 4) continue;
      const angle = (rng() - 0.5) * Math.PI;
      const bc    = colors[Math.floor(rng() * colors.length)];
      g.save();
      g.translate(px + beanW / 2, py);
      g.rotate(angle);
      g.beginPath();
      g.ellipse(0, 0, beanW / 2, beanH / 2, 0, 0, Math.PI * 2);
      g.fillStyle = bc;
      g.fill();
      g.beginPath();
      g.ellipse(-beanW * 0.15, -beanH * 0.18, beanW * 0.18, beanH * 0.12, 0, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fill();
      g.restore();
    }
  }
}

function _drawWrappedCandies(g, bx, by, bw, bh, colors, rng) {
  const cW   = Math.max(8, bw * 0.18);
  const cH   = cW * 0.55;
  const cols = Math.max(1, Math.floor(bw / (cW + 4)));
  const rows = Math.ceil(bh / (cH + 4));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = bx + 3 + col * (bw / cols) + rng() * 4 - 2;
      const py = by + bh - (cH + 4) - row * (cH + 4);
      if (py < by + 4) continue;
      const bc = colors[Math.floor(rng() * colors.length)];
      g.save();
      g.translate(px + cW / 2, py);
      g.beginPath();
      g.ellipse(0, 0, cW / 2, cH / 2, 0, 0, Math.PI * 2);
      g.fillStyle = bc;
      g.fill();
      g.strokeStyle = bc;
      g.lineWidth   = 2;
      g.lineCap     = 'round';
      for (const dir of [-1, 1]) {
        g.save();
        g.translate(dir * cW * 0.42, 0);
        g.beginPath();
        g.moveTo(0, -cH * 0.45);
        g.bezierCurveTo(dir * 4, -cH * 0.65, dir * 5, cH * 0.65, 0, cH * 0.45);
        g.stroke();
        g.restore();
      }
      g.beginPath();
      g.ellipse(-cW * 0.12, -cH * 0.18, cW * 0.15, cH * 0.12, 0, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fill();
      g.restore();
    }
  }
}

function _drawGummyBears(g, bx, by, bw, bh, colors, rng) {
  const r    = Math.max(5, bw * 0.09);
  const cols = Math.max(1, Math.floor(bw / (r * 2.8)));
  const rows = Math.ceil(bh / (r * 3.5));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = bx + 3 + col * (bw / cols) + r + rng() * 3 - 1.5;
      const cy = by + bh - r * 2 - row * (r * 3.5);
      if (cy < by + 4) continue;
      const bc = colors[Math.floor(rng() * colors.length)];
      g.save();
      g.fillStyle = bc;
      g.beginPath();
      g.ellipse(cx, cy + r * 0.3, r, r * 1.2, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(cx, cy - r * 0.6, r * 0.75, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(cx - r * 0.45, cy - r * 1.22, r * 0.32, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(cx + r * 0.45, cy - r * 1.22, r * 0.32, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(cx - r * 0.2, cy - r * 0.85, r * 0.22, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.fill();
      g.restore();
    }
  }
}

function _drawRibbonCandy(g, bx, by, bw, bh, colors, rng) {
  const n = Math.max(2, Math.floor(bw / 18));
  const cW = (bw - 8) / n;
  for (let i = 0; i < n; i++) {
    const c1  = colors[Math.floor(rng() * colors.length)];
    const cx  = bx + 4 + i * cW + cW / 2;
    const top = by + 6 + rng() * 8;
    const bot = by + bh - 4;
    const amp = cW * 0.4;
    const seg = 8;
    g.save();
    g.lineWidth   = cW * 0.72;
    g.lineCap     = 'round';
    g.strokeStyle = c1;
    g.beginPath();
    for (let s = 0; s <= seg; s++) {
      const t  = s / seg;
      const sy = top + (bot - top) * t;
      const sx = cx + Math.sin(t * Math.PI * 3.5) * amp;
      s === 0 ? g.moveTo(sx, sy) : g.lineTo(sx, sy);
    }
    g.stroke();
    g.lineWidth   = cW * 0.2;
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.stroke();
    g.restore();
  }
}

function _drawRectContainer(g, x, y, w, h, lidColor, ballColors, seed, candyType) {
  const rng  = _rng(seed);
  const bx   = x + 2, bw = w - 4;
  const by   = y + h * 0.10, bh = h * 0.86;
  const br   = 3;

  // Body — clear acrylic tint
  g.save();
  g.beginPath();
  g.roundRect(bx, by, bw, bh, [br, br, br, br]);
  g.clip();
  g.fillStyle = lidColor + '30';
  g.fillRect(bx, by, bw, bh);
  // lollipops/canes are jar-only — remap to gumballs here
  const cType = (candyType === 1 || candyType === 2) ? 0 : candyType;
  if      (cType === 3) _drawJellyBeans(g,     bx, by, bw, bh, ballColors, rng);
  else if (cType === 4) _drawWrappedCandies(g, bx, by, bw, bh, ballColors, rng);
  else if (cType === 5) _drawGummyBears(g,     bx, by, bw, bh, ballColors, rng);
  else if (cType === 6) _drawRibbonCandy(g,    bx, by, bw, bh, ballColors, rng);
  else                  _drawGumballs(g,        bx, by, bw, bh, ballColors, rng);
  // Left glare strip
  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.fillRect(bx, by, bw * 0.18, bh);
  g.restore();

  // Outline
  g.save();
  g.beginPath();
  g.roundRect(bx, by, bw, bh, br);
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth   = 1.5;
  g.stroke();
  g.restore();

  // Flat label strip at top
  g.save();
  g.beginPath();
  g.roundRect(x, y, w, h * 0.12, [br, br, 0, 0]);
  g.fillStyle = lidColor;
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.20)';
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.15)';
  g.lineWidth   = 1;
  g.stroke();
  g.restore();
}

function _drawOpenTub(g, x, y, w, h, lidColor, ballColors, seed, candyType) {
  const rng   = _rng(seed);
  const cType = (candyType === 1 || candyType === 2) ? 0 : candyType;
  const sq    = w * 0.06;   // each side squeezes inward at the bottom
  const rimH  = Math.max(5, h * 0.08);
  const bodyY = y + rimH;
  const bodyH = h - rimH;

  // Tub body — clipped to trapezoid (wider at top)
  g.save();
  g.beginPath();
  g.moveTo(x,          bodyY);
  g.lineTo(x + w,      bodyY);
  g.lineTo(x + w - sq, y + h);
  g.lineTo(x + sq,     y + h);
  g.closePath();
  g.clip();

  // Solid wall color
  g.fillStyle = lidColor;
  g.fillRect(x, bodyY, w, bodyH);

  // Subtle alternating band tint
  for (let i = 0; i < 5; i++) {
    const t0 = i / 5, t1 = (i + 1) / 5;
    g.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';
    g.beginPath();
    g.moveTo(x + t0 * w,               bodyY);
    g.lineTo(x + t1 * w,               bodyY);
    g.lineTo(x + sq + t1 * (w - 2*sq), y + h);
    g.lineTo(x + sq + t0 * (w - 2*sq), y + h);
    g.closePath();
    g.fill();
  }

  // Candy content — fill nearly to the top so it looks packed
  const candyBy = bodyY + bodyH * 0.04;
  const candyBh = bodyH * 0.92;
       if (cType === 3) _drawJellyBeans(g,     x, candyBy, w, candyBh, ballColors, rng);
  else if (cType === 4) _drawWrappedCandies(g, x, candyBy, w, candyBh, ballColors, rng);
  else if (cType === 5) _drawGummyBears(g,     x, candyBy, w, candyBh, ballColors, rng);
  else if (cType === 6) _drawRibbonCandy(g,    x, candyBy, w, candyBh, ballColors, rng);
  else                  _drawGumballs(g,        x, candyBy, w, candyBh, ballColors, rng);

  // Left glare
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(x, bodyY, w * 0.16, bodyH);

  g.restore();

  // Body outline
  g.save();
  g.beginPath();
  g.moveTo(x,          bodyY);
  g.lineTo(x + w,      bodyY);
  g.lineTo(x + w - sq, y + h);
  g.lineTo(x + sq,     y + h);
  g.closePath();
  g.strokeStyle = 'rgba(0,0,0,0.28)';
  g.lineWidth   = 2;
  g.stroke();
  g.restore();

  // Open rim
  g.save();
  g.beginPath();
  g.rect(x - 1, y, w + 2, rimH);
  g.fillStyle = lidColor;
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.2)';
  g.lineWidth   = 1.5;
  g.stroke();
  g.restore();

  // Candy mounding over the rim — more pieces, spilling above the opening
  const nMound = Math.max(14, Math.floor(w / 4));
  for (let i = 0; i < nMound; i++) {
    const mx = x + rng() * w;
    const mr = Math.max(4, w * 0.08) + rng() * 4;
    const my = y - mr * 0.5 + rng() * (rimH + mr);
    g.save();
    g.beginPath();
    g.arc(mx, my, mr, 0, Math.PI * 2);
    g.fillStyle = ballColors[Math.floor(rng() * ballColors.length)];
    g.fill();
    g.beginPath();
    g.arc(mx - mr * 0.28, my - mr * 0.28, mr * 0.25, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fill();
    g.restore();
  }
}

function _drawJar(g, x, y, w, h, lidColor, ballColors, seed, candyType) {
  const rng    = _rng(seed);
  const isOpen = (candyType === 1 || candyType === 2); // lollipops/canes: open top, overflow
  const lidH   = isOpen ? 0 : h * 0.14;
  const bx     = x + 4, bw = w - 8;
  const by     = y + lidH, bh = h * 0.78;
  const br     = w * 0.12;

  // Jar body background (always clipped to glass shape)
  g.save();
  g.beginPath();
  g.roundRect(bx, by, bw, bh, [br, br, br * 2.5, br * 2.5]);
  g.clip();
  g.fillStyle = lidColor + '55';
  g.fillRect(bx, by, bw, bh);
  if (!isOpen) {
    if      (candyType === 3) _drawJellyBeans(g,     bx, by, bw, bh, ballColors, rng);
    else if (candyType === 4) _drawWrappedCandies(g, bx, by, bw, bh, ballColors, rng);
    else if (candyType === 5) _drawGummyBears(g,     bx, by, bw, bh, ballColors, rng);
    else if (candyType === 6) _drawRibbonCandy(g,    bx, by, bw, bh, ballColors, rng);
    else                      _drawGumballs(g,        bx, by, bw, bh, ballColors, rng);
  }
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(bx, by, bw * 0.22, bh);
  g.restore();

  // Open jars: draw lollipops/canes unclipped so they overflow above the rim
  if (isOpen) {
    const overflow = h * 0.32;
    if (candyType === 1) _drawLollipops(g,  bx, by - overflow, bw, bh + overflow, ballColors, rng);
    else                 _drawCandyCanes(g, bx, by - overflow, bw, bh + overflow, rng);
  }

  // Jar glass outline
  g.save();
  g.beginPath();
  g.roundRect(bx, by, bw, bh, [br, br, br * 2.5, br * 2.5]);
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth   = 2;
  g.stroke();
  g.restore();

  if (!isOpen) {
    // Closed lid
    g.save();
    g.beginPath();
    g.roundRect(x, y, w, lidH, 5);
    g.fillStyle = lidColor;
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.2)';
    g.lineWidth   = 1.5;
    g.stroke();
    g.restore();
  } else {
    // Open rim highlight
    g.save();
    g.beginPath();
    g.roundRect(bx - 2, by, bw + 4, h * 0.04, 2);
    g.fillStyle = 'rgba(255,255,255,0.65)';
    g.fill();
    g.restore();
  }
}

function _drawBunting(g, w, topY) {
  const COLORS = ['#e74c3c','#f1c40f','#2ecc71','#3498db','#9b59b6','#e91e63','#ff922b'];
  const flagW  = Math.max(18, w / 22);
  const flagH  = flagW * 1.1;
  const n      = Math.ceil(w / flagW) + 1;
  const sag    = Math.min(16, flagH * 0.6);

  g.save();
  g.strokeStyle = 'rgba(120,90,15,0.65)';
  g.lineWidth   = 1.5;
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const t  = i / n;
    const px = t * w;
    const py = topY + sag * 4 * t * (1 - t);
    i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
  }
  g.stroke();
  g.restore();

  for (let i = 0; i < n; i++) {
    const t  = i / n;
    const px = t * w;
    const py = topY + sag * 4 * t * (1 - t);
    g.save();
    g.fillStyle = COLORS[i % COLORS.length];
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(px + flagW, py);
    g.lineTo(px + flagW / 2, py + flagH);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(px + flagW, py);
    g.lineTo(px + flagW / 2, py + flagH * 0.42);
    g.closePath();
    g.fill();
    g.restore();
  }
}

function _drawSign(g, w) {
  const signW = Math.min(280, w * 0.56);
  const signH = Math.max(44, signW * 0.22);
  const sx    = (w - signW) / 2;
  const sy    = 8;

  // Ropes to ceiling
  g.save();
  g.strokeStyle = 'rgba(120,80,15,0.75)';
  g.lineWidth   = 2;
  g.beginPath();
  g.moveTo(sx + signW * 0.2, 0);
  g.lineTo(sx + signW * 0.2, sy);
  g.moveTo(sx + signW * 0.8, 0);
  g.lineTo(sx + signW * 0.8, sy);
  g.stroke();
  g.restore();

  // Sign shadow + body (pastel-pink background)
  g.save();
  g.shadowColor   = 'rgba(0,0,0,0.25)';
  g.shadowBlur    = 18;
  g.shadowOffsetY = 5;
  g.beginPath();
  g.roundRect(sx, sy, signW, signH, 10);
  g.fillStyle = '#f9b8d0';
  g.fill();
  g.restore();

  // Inner white border
  g.save();
  g.beginPath();
  g.roundRect(sx + 4, sy + 4, signW - 8, signH - 8, 7);
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth   = 2.5;
  g.stroke();
  g.restore();

  // Sign text
  const fontSize = Math.max(18, signH * 0.44);
  g.save();
  g.font         = `bold ${fontSize}px "Fredoka One", sans-serif`;
  g.textAlign    = 'center';
  g.textBaseline = 'middle';
  g.shadowColor  = 'rgba(180,60,100,0.4)';
  g.shadowBlur   = 4;
  g.fillStyle    = '#ffffff';
  g.fillText('Candy Shop', sx + signW / 2, sy + signH / 2, signW - 60);
  g.restore();

  // White stars
  g.fillStyle = '#ffffff';
  _star(g, sx + 19, sy + signH / 2, 8);
  g.fill();
  _star(g, sx + signW - 19, sy + signH / 2, 8);
  g.fill();
}

function _drawCandyStore(g, w, h) {
  const JAR_COLORS  = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#3498db','#9b59b6','#e91e63','#1abc9c'];
  const BALL_COLORS = ['#ff6b6b','#ff9f40','#ffdd59','#badc58','#7ed6df','#a29bfe','#fd79a8','#74b9ff'];
  const CANDY_TYPES = [0, 1, 6, 3, 4, 5, 6, 0, 1, 3, 3, 4, 5, 6, 1, 4]; // 0=gumballs 1=lollipops 3=jelly beans 4=wrapped 5=gummy bears 6=ribbon
  const rngG        = _rng(31415);

  // Warm cream wall
  g.fillStyle = '#fff3e0';
  g.fillRect(0, 0, w, h);

  // Polka dot wallpaper
  const ds = Math.max(34, w * 0.055);
  g.save();
  g.globalAlpha = 0.08;
  g.fillStyle   = '#e91e63';
  for (let row = 0, py = ds; py < h * 0.86; py += ds, row++) {
    for (let px = (row % 2) * (ds / 2); px < w + ds; px += ds) {
      g.beginPath();
      g.arc(px, py, ds * 0.13, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();

  // Wainscoting (lower wall panel)
  const floorY   = h * 0.88;
  const wainTopY = floorY - h * 0.19;
  g.fillStyle = '#ffe0b2';
  g.fillRect(0, wainTopY, w, floorY - wainTopY);
  // Chair rail
  g.fillStyle = '#c8893a';
  g.fillRect(0, wainTopY, w, 7);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(0, wainTopY, w, 3);

  // Checkerboard floor
  const tileSize = Math.round(Math.max(22, Math.min(44, w / 16)));
  for (let ty = floorY; ty < h + tileSize; ty += tileSize) {
    for (let tx = 0; tx < w + tileSize; tx += tileSize) {
      const row = Math.floor((ty - floorY) / tileSize);
      const col = Math.floor(tx / tileSize);
      g.fillStyle = (row + col) % 2 === 0 ? '#efefef' : '#2d2d2d';
      g.fillRect(tx, ty, tileSize, tileSize);
    }
  }
  // Floor depth gradient
  const floorG = g.createLinearGradient(0, floorY, 0, h);
  floorG.addColorStop(0, 'rgba(0,0,0,0)');
  floorG.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = floorG;
  g.fillRect(0, floorY, w, h - floorY);

  // Three shelves — each row uses a different container style
  // Row 0: round glass jars  |  Row 1: rectangular acrylic bins  |  Row 2: wooden bulk barrels
  const shelfFracs  = [0.30, 0.54, 0.77];
  const heightMults = [1.75, 1.40, 1.60];
  for (let si = 0; si < shelfFracs.length; si++) {
    const sy  = h * shelfFracs[si];
    const shH = Math.max(10, h * 0.018);

    g.save();
    g.shadowColor   = 'rgba(0,0,0,0.3)';
    g.shadowBlur    = 10;
    g.shadowOffsetY = 6;
    g.fillStyle     = '#7d4f1a';
    g.fillRect(0, sy, w, shH);
    g.restore();
    g.fillStyle = 'rgba(0,0,0,0.10)';
    g.fillRect(0, sy + shH, w, 8);
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.fillRect(0, sy, w, 3);

    const bSpacing = Math.max(80, w / 8);
    g.fillStyle = '#5c3317';
    for (let bx = bSpacing * 0.5; bx < w; bx += bSpacing) {
      g.beginPath();
      g.moveTo(bx - 5, sy);
      g.lineTo(bx - 5, sy + shH + 16);
      g.lineTo(bx + 5, sy + shH + 16);
      g.lineTo(bx + 5, sy);
      g.closePath();
      g.fill();
    }

    const jarW  = Math.min(62, w / 7.5);
    const jarH  = jarW * heightMults[si];
    const gap   = jarW * 0.32;
    const nJars = Math.floor((w + gap) / (jarW + gap));
    const ox    = (w - (nJars * jarW + (nJars - 1) * gap)) / 2;

    for (let j = 0; j < nJars; j++) {
      const ci        = Math.floor(rngG() * JAR_COLORS.length);
      const candyType = CANDY_TYPES[(si * 4 + j) % CANDY_TYPES.length];
      const cx        = ox + j * (jarW + gap);
      // Align each container's visual bottom flush with the shelf surface.
      // _drawJar closed: bottom at y+0.92h; open (lollipops/canes): body ends at y+0.78h.
      // _drawRectContainer: bottom at y+0.96h. _drawOpenTub: bottom at y+h.
      const isOpenJar  = (si === 0) && (candyType === 1 || candyType === 2);
      const bottomFrac = isOpenJar ? 0.78 : si === 0 ? 0.92 : si === 1 ? 0.96 : 1.0;
      const cy         = sy - jarH * bottomFrac;
      if      (si === 0) _drawJar(g,            cx, cy, jarW, jarH, JAR_COLORS[ci], BALL_COLORS, si * 50 + j + 1, candyType);
      else if (si === 1) _drawRectContainer(g,  cx, cy, jarW, jarH, JAR_COLORS[ci], BALL_COLORS, si * 50 + j + 1, candyType);
      else               _drawOpenTub(g,          cx, cy, jarW, jarH, JAR_COLORS[ci], BALL_COLORS, si * 50 + j + 1, candyType);
    }
  }

  // Bunting flags strung below the sign
  _drawBunting(g, w, 62);

  // Candy Shop hanging sign (drawn last so it's on top)
  _drawSign(g, w);
}

function _buildBgCache() {
  const oc  = document.createElement('canvas');
  oc.width  = Math.round(cw * DPR);
  oc.height = Math.round(ch * DPR);
  const g   = oc.getContext('2d');
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  _drawCandyStore(g, cw, ch);
  bgCache = oc;
}

function drawBackground() {
  if (state.activeMode === 'alphabet') {
    if (!abcBgCache) _buildAbcBgCache();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(abcBgCache, 0, 0);
    ctx.restore();
    return;
  }
  if (!bgCache) _buildBgCache();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bgCache, 0, 0);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// ALPHABET MODE  —  word data, pictures, classroom background, rendering
// ─────────────────────────────────────────────────────────────────────────────

const ALPHABET_WORDS = [
  { letter: 'A', word: 'ANT',  draw: _picAnt  },
  { letter: 'B', word: 'BEE',  draw: _picBee  },
  { letter: 'C', word: 'CAR',  draw: _picCar  },
  { letter: 'D', word: 'DOG',  draw: _picDog  },
  { letter: 'E', word: 'EGG',  draw: _picEgg  },
  { letter: 'F', word: 'FISH', draw: _picFish },
  { letter: 'H', word: 'HAT',  draw: _picHat  },
  { letter: 'K', word: 'KEY',  draw: _picKey  },
  { letter: 'M', word: 'MOON', draw: _picMoon },
  { letter: 'O', word: 'OWL',  draw: _picOwl  },
  { letter: 'P', word: 'PIG',  draw: _picPig  },
  { letter: 'S', word: 'SUN',  draw: _picSun  },
];

// ── Picture drawing functions (each draws centered at cx, cy within size s) ─

function _picAnt(g, cx, cy, s) {
  const r = s * 0.12;
  // Body segments
  g.fillStyle = '#2d2d2d';
  g.beginPath(); g.arc(cx, cy - r * 2.2, r * 0.85, 0, Math.PI * 2); g.fill(); // head
  g.beginPath(); g.arc(cx, cy,            r,         0, Math.PI * 2); g.fill(); // thorax
  g.beginPath(); g.arc(cx, cy + r * 2.5,  r * 1.2,   0, Math.PI * 2); g.fill(); // abdomen
  // Eyes
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(cx - r * 0.35, cy - r * 2.5, r * 0.22, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + r * 0.35, cy - r * 2.5, r * 0.22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#000';
  g.beginPath(); g.arc(cx - r * 0.35, cy - r * 2.5, r * 0.1, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + r * 0.35, cy - r * 2.5, r * 0.1, 0, Math.PI * 2); g.fill();
  // Antennae
  g.strokeStyle = '#2d2d2d'; g.lineWidth = 2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - r * 0.3, cy - r * 3); g.quadraticCurveTo(cx - r * 1.5, cy - r * 5, cx - r * 1.8, cy - r * 4.5); g.stroke();
  g.beginPath(); g.moveTo(cx + r * 0.3, cy - r * 3); g.quadraticCurveTo(cx + r * 1.5, cy - r * 5, cx + r * 1.8, cy - r * 4.5); g.stroke();
  // Legs (3 pairs)
  for (let i = -1; i <= 1; i++) {
    const ly = cy + i * r * 1.1;
    g.beginPath(); g.moveTo(cx - r, ly); g.lineTo(cx - r * 2.5, ly - r * 0.5); g.stroke();
    g.beginPath(); g.moveTo(cx + r, ly); g.lineTo(cx + r * 2.5, ly - r * 0.5); g.stroke();
  }
}

function _picBee(g, cx, cy, s) {
  const r = s * 0.22;
  // Wings
  g.fillStyle = 'rgba(200,230,255,0.6)';
  g.beginPath(); g.ellipse(cx - r * 0.8, cy - r * 1.1, r * 0.6, r * 0.9, -0.3, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + r * 0.8, cy - r * 1.1, r * 0.6, r * 0.9, 0.3, 0, Math.PI * 2); g.fill();
  // Body
  g.fillStyle = '#ffd700';
  g.beginPath(); g.ellipse(cx, cy, r, r * 1.3, 0, 0, Math.PI * 2); g.fill();
  // Stripes
  g.fillStyle = '#2d2d2d';
  for (let i = -1; i <= 1; i++) {
    g.fillRect(cx - r, cy + i * r * 0.5 - r * 0.1, r * 2, r * 0.22);
  }
  // Head
  g.fillStyle = '#2d2d2d';
  g.beginPath(); g.arc(cx, cy - r * 1.3, r * 0.5, 0, Math.PI * 2); g.fill();
  // Eyes
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(cx - r * 0.2, cy - r * 1.4, r * 0.15, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + r * 0.2, cy - r * 1.4, r * 0.15, 0, Math.PI * 2); g.fill();
  // Stinger
  g.fillStyle = '#333';
  g.beginPath(); g.moveTo(cx, cy + r * 1.3); g.lineTo(cx - r * 0.1, cy + r * 1.7); g.lineTo(cx + r * 0.1, cy + r * 1.7); g.closePath(); g.fill();
}

function _picCar(g, cx, cy, s) {
  const w = s * 0.45, h = s * 0.2;
  // Body
  g.fillStyle = '#e74c3c';
  g.beginPath(); g.roundRect(cx - w, cy - h * 0.3, w * 2, h, 8); g.fill();
  // Roof
  g.fillStyle = '#c0392b';
  g.beginPath(); g.roundRect(cx - w * 0.45, cy - h * 1.1, w * 0.9, h * 0.85, [8, 8, 0, 0]); g.fill();
  // Windows
  g.fillStyle = '#aee1f9';
  g.fillRect(cx - w * 0.38, cy - h * 0.95, w * 0.34, h * 0.55);
  g.fillRect(cx + w * 0.06, cy - h * 0.95, w * 0.34, h * 0.55);
  // Wheels
  g.fillStyle = '#2d2d2d';
  g.beginPath(); g.arc(cx - w * 0.55, cy + h * 0.7, h * 0.38, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + w * 0.55, cy + h * 0.7, h * 0.38, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#888';
  g.beginPath(); g.arc(cx - w * 0.55, cy + h * 0.7, h * 0.18, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + w * 0.55, cy + h * 0.7, h * 0.18, 0, Math.PI * 2); g.fill();
  // Headlight
  g.fillStyle = '#ffd700';
  g.beginPath(); g.arc(cx + w - 4, cy, h * 0.15, 0, Math.PI * 2); g.fill();
}

function _picDog(g, cx, cy, s) {
  const r = s * 0.22;
  // Face
  g.fillStyle = '#d4a056';
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  // Ears
  g.fillStyle = '#8B6914';
  g.beginPath(); g.ellipse(cx - r * 0.9, cy - r * 0.6, r * 0.4, r * 0.7, -0.3, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + r * 0.9, cy - r * 0.6, r * 0.4, r * 0.7, 0.3, 0, Math.PI * 2); g.fill();
  // Eyes
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(cx - r * 0.35, cy - r * 0.2, r * 0.22, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + r * 0.35, cy - r * 0.2, r * 0.22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2d2d2d';
  g.beginPath(); g.arc(cx - r * 0.35, cy - r * 0.2, r * 0.11, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + r * 0.35, cy - r * 0.2, r * 0.11, 0, Math.PI * 2); g.fill();
  // Nose
  g.fillStyle = '#333';
  g.beginPath(); g.ellipse(cx, cy + r * 0.35, r * 0.18, r * 0.14, 0, 0, Math.PI * 2); g.fill();
  // Mouth
  g.strokeStyle = '#333'; g.lineWidth = 2; g.lineCap = 'round';
  g.beginPath(); g.arc(cx, cy + r * 0.35, r * 0.3, 0.2, Math.PI - 0.2); g.stroke();
  // Tongue
  g.fillStyle = '#ff6b81';
  g.beginPath(); g.ellipse(cx, cy + r * 0.72, r * 0.12, r * 0.2, 0, 0, Math.PI * 2); g.fill();
}

function _picEgg(g, cx, cy, s) {
  const r = s * 0.2;
  // Egg shape
  g.fillStyle = '#fdf5e6';
  g.beginPath(); g.ellipse(cx, cy, r * 0.8, r * 1.2, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#d4c5a0'; g.lineWidth = 2;
  g.beginPath(); g.ellipse(cx, cy, r * 0.8, r * 1.2, 0, 0, Math.PI * 2); g.stroke();
  // Highlight
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.beginPath(); g.ellipse(cx - r * 0.25, cy - r * 0.5, r * 0.2, r * 0.35, -0.3, 0, Math.PI * 2); g.fill();
  // Crack line
  g.strokeStyle = '#bba87e'; g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(cx - r * 0.5, cy + r * 0.1);
  g.lineTo(cx - r * 0.15, cy - r * 0.15);
  g.lineTo(cx + r * 0.1, cy + r * 0.2);
  g.lineTo(cx + r * 0.4, cy);
  g.stroke();
}

function _picFish(g, cx, cy, s) {
  const r = s * 0.22;
  // Body
  g.fillStyle = '#ff922b';
  g.beginPath(); g.ellipse(cx, cy, r * 1.3, r * 0.8, 0, 0, Math.PI * 2); g.fill();
  // Tail
  g.beginPath();
  g.moveTo(cx - r * 1.2, cy);
  g.lineTo(cx - r * 2, cy - r * 0.7);
  g.lineTo(cx - r * 2, cy + r * 0.7);
  g.closePath();
  g.fillStyle = '#e67e22'; g.fill();
  // Eye
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(cx + r * 0.5, cy - r * 0.15, r * 0.22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#000';
  g.beginPath(); g.arc(cx + r * 0.55, cy - r * 0.15, r * 0.1, 0, Math.PI * 2); g.fill();
  // Fin
  g.fillStyle = '#e67e22';
  g.beginPath();
  g.moveTo(cx - r * 0.1, cy - r * 0.8);
  g.quadraticCurveTo(cx + r * 0.2, cy - r * 1.4, cx + r * 0.5, cy - r * 0.8);
  g.closePath(); g.fill();
  // Mouth
  g.strokeStyle = '#c0392b'; g.lineWidth = 2;
  g.beginPath(); g.arc(cx + r * 1.1, cy + r * 0.1, r * 0.15, 0.5, Math.PI - 0.5); g.stroke();
}

function _picHat(g, cx, cy, s) {
  const w = s * 0.25, h = s * 0.35;
  // Brim
  g.fillStyle = '#e74c3c';
  g.beginPath(); g.ellipse(cx, cy + h * 0.35, w * 1.4, h * 0.18, 0, 0, Math.PI * 2); g.fill();
  // Crown
  g.fillStyle = '#e74c3c';
  g.beginPath(); g.roundRect(cx - w * 0.75, cy - h * 0.5, w * 1.5, h * 0.9, [12, 12, 0, 0]); g.fill();
  // Band
  g.fillStyle = '#2d2d2d';
  g.fillRect(cx - w * 0.75, cy + h * 0.2, w * 1.5, h * 0.12);
  // Highlight
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(cx - w * 0.65, cy - h * 0.45, w * 0.3, h * 0.8);
}

function _picKey(g, cx, cy, s) {
  const r = s * 0.12;
  // Handle ring
  g.strokeStyle = '#ffd700'; g.lineWidth = s * 0.04;
  g.beginPath(); g.arc(cx, cy - r * 1.5, r, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#ffeaa7';
  g.beginPath(); g.arc(cx, cy - r * 1.5, r * 0.7, 0, Math.PI * 2); g.fill();
  // Shaft
  g.fillStyle = '#ffd700';
  g.fillRect(cx - r * 0.2, cy - r * 0.5, r * 0.4, s * 0.35);
  // Teeth
  g.fillRect(cx + r * 0.2, cy + s * 0.15, r * 0.5, r * 0.25);
  g.fillRect(cx + r * 0.2, cy + s * 0.25, r * 0.35, r * 0.25);
}

function _picMoon(g, cx, cy, s) {
  const r = s * 0.25;
  // Moon body
  g.fillStyle = '#ffd700';
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  // Cut out crescent
  g.fillStyle = '#1a1a4e';
  g.beginPath(); g.arc(cx + r * 0.45, cy - r * 0.25, r * 0.8, 0, Math.PI * 2); g.fill();
  // Stars
  g.fillStyle = '#ffd700';
  const stars = [[cx + r * 1.3, cy - r * 0.8, 4], [cx + r * 0.9, cy + r * 0.9, 3], [cx - r * 0.6, cy - r * 1.3, 3.5]];
  for (const [sx, sy, sr] of stars) {
    _star(g, sx, sy, sr); g.fill();
  }
}

function _picOwl(g, cx, cy, s) {
  const r = s * 0.22;
  // Body
  g.fillStyle = '#8B6914';
  g.beginPath(); g.ellipse(cx, cy + r * 0.3, r, r * 1.2, 0, 0, Math.PI * 2); g.fill();
  // Belly
  g.fillStyle = '#d4a056';
  g.beginPath(); g.ellipse(cx, cy + r * 0.7, r * 0.55, r * 0.7, 0, 0, Math.PI * 2); g.fill();
  // Eyes (big)
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(cx - r * 0.4, cy - r * 0.3, r * 0.35, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + r * 0.4, cy - r * 0.3, r * 0.35, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ff922b';
  g.beginPath(); g.arc(cx - r * 0.4, cy - r * 0.3, r * 0.22, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + r * 0.4, cy - r * 0.3, r * 0.22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#000';
  g.beginPath(); g.arc(cx - r * 0.4, cy - r * 0.3, r * 0.1, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + r * 0.4, cy - r * 0.3, r * 0.1, 0, Math.PI * 2); g.fill();
  // Beak
  g.fillStyle = '#ff922b';
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - r * 0.12, cy + r * 0.25); g.lineTo(cx + r * 0.12, cy + r * 0.25); g.closePath(); g.fill();
  // Ear tufts
  g.fillStyle = '#8B6914';
  g.beginPath(); g.moveTo(cx - r * 0.6, cy - r * 0.9); g.lineTo(cx - r * 0.8, cy - r * 1.5); g.lineTo(cx - r * 0.2, cy - r * 0.9); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(cx + r * 0.6, cy - r * 0.9); g.lineTo(cx + r * 0.8, cy - r * 1.5); g.lineTo(cx + r * 0.2, cy - r * 0.9); g.closePath(); g.fill();
  // Feet
  g.strokeStyle = '#8B6914'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(cx - r * 0.3, cy + r * 1.4); g.lineTo(cx - r * 0.5, cy + r * 1.65); g.stroke();
  g.beginPath(); g.moveTo(cx - r * 0.3, cy + r * 1.4); g.lineTo(cx - r * 0.1, cy + r * 1.65); g.stroke();
  g.beginPath(); g.moveTo(cx + r * 0.3, cy + r * 1.4); g.lineTo(cx + r * 0.5, cy + r * 1.65); g.stroke();
  g.beginPath(); g.moveTo(cx + r * 0.3, cy + r * 1.4); g.lineTo(cx + r * 0.1, cy + r * 1.65); g.stroke();
}

function _picPig(g, cx, cy, s) {
  const r = s * 0.24;
  // Face
  g.fillStyle = '#ffb6c1';
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  // Ears
  g.fillStyle = '#ff8fa3';
  g.beginPath(); g.moveTo(cx - r * 0.6, cy - r * 0.7); g.lineTo(cx - r * 1.0, cy - r * 1.3); g.lineTo(cx - r * 0.2, cy - r * 0.9); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(cx + r * 0.6, cy - r * 0.7); g.lineTo(cx + r * 1.0, cy - r * 1.3); g.lineTo(cx + r * 0.2, cy - r * 0.9); g.closePath(); g.fill();
  // Inner ear
  g.fillStyle = '#ff6b81';
  g.beginPath(); g.moveTo(cx - r * 0.55, cy - r * 0.75); g.lineTo(cx - r * 0.85, cy - r * 1.15); g.lineTo(cx - r * 0.3, cy - r * 0.9); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(cx + r * 0.55, cy - r * 0.75); g.lineTo(cx + r * 0.85, cy - r * 1.15); g.lineTo(cx + r * 0.3, cy - r * 0.9); g.closePath(); g.fill();
  // Snout
  g.fillStyle = '#ff8fa3';
  g.beginPath(); g.ellipse(cx, cy + r * 0.2, r * 0.4, r * 0.3, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#d6637a';
  g.beginPath(); g.arc(cx - r * 0.13, cy + r * 0.22, r * 0.08, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + r * 0.13, cy + r * 0.22, r * 0.08, 0, Math.PI * 2); g.fill();
  // Eyes
  g.fillStyle = '#2d2d2d';
  g.beginPath(); g.arc(cx - r * 0.35, cy - r * 0.2, r * 0.1, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + r * 0.35, cy - r * 0.2, r * 0.1, 0, Math.PI * 2); g.fill();
  // Smile
  g.strokeStyle = '#d6637a'; g.lineWidth = 2; g.lineCap = 'round';
  g.beginPath(); g.arc(cx, cy + r * 0.35, r * 0.25, 0.2, Math.PI - 0.2); g.stroke();
}

function _picSun(g, cx, cy, s) {
  const r = s * 0.18;
  // Rays
  g.strokeStyle = '#ffd700'; g.lineWidth = s * 0.03; g.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 1.2);
    g.lineTo(cx + Math.cos(a) * r * 1.8, cy + Math.sin(a) * r * 1.8);
    g.stroke();
  }
  // Body
  g.fillStyle = '#ffd700';
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  // Face
  g.fillStyle = '#2d2d2d';
  g.beginPath(); g.arc(cx - r * 0.3, cy - r * 0.15, r * 0.08, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + r * 0.3, cy - r * 0.15, r * 0.08, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#e67e22'; g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy + r * 0.1, r * 0.3, 0.15, Math.PI - 0.15); g.stroke();
}

// ── Classroom background ────────────────────────────────────────────────────

let abcBgCache = null;

function _drawClassroom(g, w, h) {
  // Warm wall
  g.fillStyle = '#fff8e7';
  g.fillRect(0, 0, w, h);

  // Chalkboard
  const cbY = h * 0.02, cbH = h * 0.22;
  // Wooden frame
  g.fillStyle = '#6d4c2a';
  g.fillRect(w * 0.06, cbY - 6, w * 0.88, cbH + 12);
  // Green board
  g.fillStyle = '#2e7d32';
  g.fillRect(w * 0.08, cbY, w * 0.84, cbH);
  // Chalk dust effect
  g.fillStyle = 'rgba(255,255,255,0.06)';
  g.fillRect(w * 0.08, cbY, w * 0.84, cbH);
  // Chalk tray
  g.fillStyle = '#5d3a1a';
  g.fillRect(w * 0.08, cbY + cbH, w * 0.84, 8);
  g.fillStyle = 'rgba(255,255,255,0.2)';
  g.fillRect(w * 0.08, cbY + cbH, w * 0.84, 3);

  // Alphabet frieze below chalkboard
  const friezeY = cbY + cbH + 16;
  const boxW    = Math.max(10, (w - 20) / 26);
  const boxH    = boxW * 1.15;
  const friezeX = (w - boxW * 26) / 2;
  const friezeColors = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#3498db','#9b59b6','#e91e63','#1abc9c','#ff922b','#6c5ce7'];
  const fontSize = Math.max(7, boxW * 0.6);
  g.font = `bold ${fontSize}px "Fredoka One", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 26; i++) {
    const bx = friezeX + i * boxW;
    g.fillStyle = friezeColors[i % friezeColors.length];
    g.beginPath(); g.roundRect(bx + 1, friezeY, boxW - 2, boxH, 3); g.fill();
    g.fillStyle = '#fff';
    g.fillText(String.fromCharCode(65 + i), bx + boxW / 2, friezeY + boxH / 2);
  }

  // Wainscoting
  const wainY = h * 0.72;
  g.fillStyle = '#ffe0b2';
  g.fillRect(0, wainY, w, h * 0.06);
  g.fillStyle = '#c8893a';
  g.fillRect(0, wainY, w, 5);

  // Lower wall color (light blue)
  g.fillStyle = '#e3f2fd';
  g.fillRect(0, wainY + h * 0.06, w, h - wainY - h * 0.06);

  // Wooden floor
  const floorY = h * 0.86;
  const plankH = Math.max(14, h * 0.028);
  for (let py = floorY; py < h; py += plankH) {
    const row = Math.floor((py - floorY) / plankH);
    g.fillStyle = row % 2 === 0 ? '#c8893a' : '#b37a2e';
    g.fillRect(0, py, w, plankH);
    g.fillStyle = 'rgba(0,0,0,0.06)';
    g.fillRect(0, py + plankH - 1, w, 1);
  }

  // Bulletin board on the right
  const bbW = w * 0.22, bbH = h * 0.18;
  const bbX = w * 0.74, bbY = h * 0.35;
  g.fillStyle = '#5d3a1a';
  g.fillRect(bbX - 4, bbY - 4, bbW + 8, bbH + 8);
  g.fillStyle = '#d4a056';
  g.fillRect(bbX, bbY, bbW, bbH);
  // Colored pushpins
  const pinColors = ['#e74c3c','#3498db','#2ecc71','#f1c40f','#9b59b6'];
  for (let i = 0; i < 5; i++) {
    g.fillStyle = pinColors[i];
    g.beginPath();
    g.arc(bbX + bbW * (0.15 + i * 0.18), bbY + bbH * 0.2, 4, 0, Math.PI * 2);
    g.fill();
  }

  // Cubbies on the left
  const cubX = w * 0.02, cubY = h * 0.38, cubW = w * 0.18, cubH = h * 0.28;
  g.fillStyle = '#a0784c';
  g.fillRect(cubX, cubY, cubW, cubH);
  // Shelves
  for (let i = 0; i <= 3; i++) {
    const sy = cubY + (i / 3) * cubH;
    g.fillStyle = '#8B6914';
    g.fillRect(cubX, sy, cubW, 3);
  }
  // Dividers
  g.fillStyle = '#8B6914';
  g.fillRect(cubX + cubW / 2 - 1, cubY, 3, cubH);
}

function _buildAbcBgCache() {
  const oc  = document.createElement('canvas');
  oc.width  = Math.round(cw * DPR);
  oc.height = Math.round(ch * DPR);
  const g   = oc.getContext('2d');
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  _drawClassroom(g, cw, ch);
  abcBgCache = oc;
}

// ── Alphabet game logic ─────────────────────────────────────────────────────

function _shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startAlphabetMode() {
  state.abc.wordOrder = _shuffleArray(ALPHABET_WORDS.map((_, i) => i));
  state.abc.wordIdx   = 0;
  _setupAbcRound();
}

function _setupAbcRound() {
  const abc = state.abc;
  abc.phase     = 'playing';
  abc.placed    = false;
  abc.dragging  = false;
  abc.particles = [];

  const entry   = ALPHABET_WORDS[abc.wordOrder[abc.wordIdx % abc.wordOrder.length]];
  const word    = entry.word;

  // Layout calculations
  const charSize = Math.min(52, cw / 8);
  const gap      = charSize * 0.15;
  const rowW     = word.length * (charSize + gap) - gap;
  const rowX     = (cw - rowW) / 2;
  const rowY     = ch * 0.62;

  // Drop zone = the first character box
  abc.dropX  = rowX;
  abc.dropY  = rowY;
  abc.dropW  = charSize;
  abc.dropH  = charSize;

  // Draggable tile
  abc.tileW     = charSize * 1.3;
  abc.tileH     = charSize * 1.3;
  abc.tileHomeX = (cw - abc.tileW) / 2;
  abc.tileHomeY = ch * 0.82;
  abc.tileX     = abc.tileHomeX;
  abc.tileY     = abc.tileHomeY;
}

function _abcCurrentEntry() {
  return ALPHABET_WORDS[state.abc.wordOrder[state.abc.wordIdx % state.abc.wordOrder.length]];
}

function _abcCelebrate() {
  const abc = state.abc;
  abc.phase    = 'celebrating';
  abc.celStart = performance.now();
  const msgs   = CONFIG.celebrationMessages;
  abc.celMsg   = msgs[abc.wordIdx % msgs.length];
  // Particles
  const ox = cw / 2, oy = ch * 0.5;
  const colors = CONFIG.particleColors;
  for (let i = 0; i < 50; i++) {
    const angle = (Math.PI * 2 * i) / 50 + (Math.random() - 0.5) * 0.5;
    const speed = 4 + Math.random() * 10;
    abc.particles.push({
      x: ox, y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      r: 5 + Math.random() * 7,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1.0, decay: 0.011 + Math.random() * 0.013,
    });
  }
  sparkleSound.currentTime = 0;
  sparkleSound.play().catch(() => {});
}

function _abcAdvance() {
  state.abc.wordIdx++;
  // Re-shuffle if we've gone through all words
  if (state.abc.wordIdx >= state.abc.wordOrder.length) {
    state.abc.wordOrder = _shuffleArray(ALPHABET_WORDS.map((_, i) => i));
    state.abc.wordIdx   = 0;
  }
  _setupAbcRound();
}

// ── Alphabet rendering ──────────────────────────────────────────────────────

function renderAlphabet(timestamp) {
  const abc   = state.abc;
  const entry = _abcCurrentEntry();

  // Hint text on chalkboard
  ctx.save();
  ctx.font         = `bold 20px "${CONFIG.font}", sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = 'rgba(255,255,255,0.9)';
  ctx.shadowColor  = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur   = 4;
  ctx.fillText('Drag the letter!', cw / 2, ch * 0.13);
  ctx.restore();

  // Picture
  const picCx = cw / 2;
  const picCy = ch * 0.38;
  const picS  = Math.min(cw * 0.6, ch * 0.3);

  // Picture card background
  ctx.save();
  ctx.shadowColor   = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur    = 16;
  ctx.shadowOffsetY = 4;
  ctx.beginPath();
  ctx.roundRect(picCx - picS * 0.55, picCy - picS * 0.5, picS * 1.1, picS * 1.0, 18);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fill();
  ctx.restore();

  entry.draw(ctx, picCx, picCy, picS);

  // Word row
  const charSize = Math.min(52, cw / 8);
  const gapX     = charSize * 0.15;
  const word     = entry.word;
  const rowW     = word.length * (charSize + gapX) - gapX;
  const rowX     = (cw - rowW) / 2;
  const rowY     = ch * 0.62;

  for (let i = 0; i < word.length; i++) {
    const bx = rowX + i * (charSize + gapX);
    if (i === 0) {
      // Drop zone box (dashed if empty, solid if placed)
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(bx, rowY, charSize, charSize, 8);
      if (abc.placed) {
        ctx.fillStyle = '#badc58';
        ctx.fill();
        ctx.fillStyle = '#2d2d2d';
        ctx.font      = `bold ${charSize * 0.7}px "${CONFIG.font}", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(word[0], bx + charSize / 2, rowY + charSize / 2);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fill();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth   = 2;
        ctx.stroke();
        // Question mark hint
        ctx.fillStyle = '#ccc';
        ctx.font      = `bold ${charSize * 0.5}px "${CONFIG.font}", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('?', bx + charSize / 2, rowY + charSize / 2);
      }
      ctx.restore();
    } else {
      // Static letter box
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(bx, rowY, charSize, charSize, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
      ctx.fillStyle   = '#2d2d2d';
      ctx.font        = `bold ${charSize * 0.7}px "${CONFIG.font}", sans-serif`;
      ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(word[i], bx + charSize / 2, rowY + charSize / 2);
      ctx.restore();
    }
  }

  // Draggable tile (only if not placed)
  if (!abc.placed && abc.phase === 'playing') {
    const pulse = 0.5 + 0.5 * Math.sin(timestamp * 0.003);
    ctx.save();
    ctx.shadowColor   = `rgba(46,204,113,${0.3 + pulse * 0.3})`;
    ctx.shadowBlur    = 14 + pulse * 8;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.roundRect(abc.tileX, abc.tileY, abc.tileW, abc.tileH, 14);
    ctx.fillStyle = '#2ecc71';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth   = 2;
    ctx.stroke();
    ctx.fillStyle    = '#fff';
    ctx.font         = `bold ${abc.tileW * 0.6}px "${CONFIG.font}", sans-serif`;
    ctx.textAlign    = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(entry.letter, abc.tileX + abc.tileW / 2, abc.tileY + abc.tileH / 2);
    ctx.restore();
  }

  // Celebration
  if (abc.phase === 'celebrating') {
    const elapsed = timestamp - abc.celStart;
    // Update particles
    for (const p of abc.particles) {
      p.x  += p.vx; p.y  += p.vy;
      p.vy += 0.22;  p.vx *= 0.99;
      p.life -= p.decay;
    }
    abc.particles = abc.particles.filter(p => p.life > 0);
    // Draw particles
    for (const p of abc.particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.restore();
    }
    // Celebration text
    const t     = Math.min(elapsed / CONFIG.celebrationDuration, 1);
    const scale = t < 0.25 ? t / 0.25 : t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
    ctx.save();
    ctx.translate(cw / 2, ch * 0.5);
    ctx.scale(scale, scale);
    ctx.font         = `bold 52px "${CONFIG.font}", sans-serif`;
    ctx.textAlign    = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor  = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur   = 12;
    ctx.fillStyle    = CONFIG.colors.celebrationText;
    ctx.fillText(abc.celMsg, 0, 0);
    ctx.restore();

    if (elapsed >= CONFIG.celebrationDuration) {
      _abcAdvance();
    }
  }
}

function drawTrail() {
  const pts = state.trail;
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = CONFIG.colors.trail;
  ctx.lineWidth   = 20;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.restore();
}

function drawDots() {
  for (const dot of state.dots) {
    if (dot.cleared) continue;
    ctx.save();
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, CONFIG.dotRadius, 0, Math.PI * 2);
    ctx.fillStyle   = CONFIG.colors.dot;
    ctx.fill();
    ctx.restore();
  }
}

function drawProgressBar() {
  const total = state.dots.length;
  if (total === 0) return;

  const progress = state.dots.filter(d => d.cleared).length / total;
  const barW = cw * 0.6;
  const barH = 16;
  const barX = (cw - barW) / 2;
  const barY = ch - 50;
  const r    = barH / 2;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, r);
  ctx.fillStyle = CONFIG.colors.progressBg;
  ctx.fill();

  if (progress > 0.005) {
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * progress, barH, r);
    ctx.fillStyle = CONFIG.colors.progressFill;
    ctx.fill();
  }
  ctx.restore();
}

function drawHintLabel() {
  if (!state.showHint) return;
  // Position below the bottom of the bunting flags
  const flagW = Math.max(18, cw / 22);
  const flagH = flagW * 1.1;
  const sag   = Math.min(16, flagH * 0.6);
  const textY = 62 + flagH + sag + 20;
  ctx.save();
  ctx.font         = `bold 22px "${CONFIG.font}", sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle    = CONFIG.colors.hintLabel;
  ctx.shadowColor  = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur   = 8;
  ctx.fillText('Trace the number!', cw / 2, textY);
  ctx.restore();
}

function drawGuideArrows(timestamp) {
  const label  = String(state.currentNumber);
  const pulse  = 0.5 + 0.5 * Math.sin(timestamp * 0.0025);
  const bounce = Math.abs(Math.sin(timestamp * 0.0033)) * 10;

  for (let di = 0; di < label.length; di++) {
    const digitDots = state.digitDotGroups[di];
    if (!digitDots || digitDots.length === 0) continue;

    // Skip this digit once it is fully traced
    if (digitDots.every(d => d.cleared)) continue;

    // Frontier = first uncleared dot in path order for this digit
    const frontierIdx = digitDots.findIndex(d => !d.cleared);
    const frontier    = digitDots[frontierIdx];

    // Direction vector along the path at the frontier
    let dx = 0, dy = -1;
    if (frontierIdx < digitDots.length - 1) {
      const next = digitDots[frontierIdx + 1];
      const len  = Math.hypot(next.x - frontier.x, next.y - frontier.y);
      if (len > 0.01) { dx = (next.x - frontier.x) / len; dy = (next.y - frontier.y) / len; }
    } else if (frontierIdx > 0) {
      const prev = digitDots[frontierIdx - 1];
      const len  = Math.hypot(frontier.x - prev.x, frontier.y - prev.y);
      if (len > 0.01) { dx = (frontier.x - prev.x) / len; dy = (frontier.y - prev.y) / len; }
    }

    const angle      = Math.atan2(dy, dx);
    const noneCleared = digitDots.every(d => !d.cleared);

    // Pulsing ring only before this digit has been started
    if (noneCleared) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(frontier.x, frontier.y, 14 + pulse * 6, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 215, 0, ${0.5 + pulse * 0.5})`;
      ctx.lineWidth   = 3;
      ctx.stroke();
      ctx.restore();
    }

    // Arrowhead placed just ahead of the frontier, pointing in the direction of travel
    const arrowOffset = 32 + bounce;
    const ax = frontier.x + dx * arrowOffset;
    const ay = frontier.y + dy * arrowOffset;
    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur    = 6;
    ctx.translate(ax, ay);
    ctx.rotate(angle);
    ctx.fillStyle = `rgba(255, 215, 0, ${0.7 + pulse * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(14,  0);
    ctx.lineTo(-6, -9);
    ctx.lineTo(-6,  9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.restore();
  }
}

function drawCelebrationText(elapsed) {
  const t     = Math.min(elapsed / CONFIG.celebrationDuration, 1);
  const scale = t < 0.25 ? t / 0.25
              : t < 0.75 ? 1
              : 1 - (t - 0.75) / 0.25;
  ctx.save();
  ctx.translate(cw / 2, ch / 2 - ch * 0.12);
  ctx.scale(scale, scale);
  ctx.font         = `bold 58px "${CONFIG.font}", sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor  = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur   = 12;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = CONFIG.colors.celebrationText;
  ctx.fillText(state.celebrationMsg, 0, 0);
  ctx.restore();
}

function drawNumberCard() {
  const layout  = getLayout(state.currentNumber);
  const label   = String(state.currentNumber);
  const n       = label.length;
  const totalW  = (n * 100 + (n - 1) * DIGIT_GAP) * layout.scale;
  const totalH  = 140 * layout.scale;
  const pad     = Math.max(20, layout.scale * 14);
  const rx      = layout.ox - pad;
  const ry      = layout.oy - pad;
  const rw      = totalW + pad * 2;
  const rh      = totalH + pad * 2;

  ctx.save();
  ctx.shadowColor   = 'rgba(0, 0, 0, 0.18)';
  ctx.shadowBlur    = 28;
  ctx.shadowOffsetY = 8;
  ctx.beginPath();
  ctx.roundRect(rx, ry, rw, rh, 28);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.lineWidth   = 2;
  ctx.stroke();
  ctx.restore();
}



function render(timestamp) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, cw, ch);

  drawBackground();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
  ctx.fillRect(0, 0, cw, ch);

  if (state.activeMode === 'alphabet') {
    renderAlphabet(timestamp);
    requestAnimationFrame(render);
    return;
  }

  if (state.phase === 'tracing') {
    drawNumber(ctx, state.currentNumber);
    drawTrail();
    drawDots();
    drawProgressBar();
    drawHintLabel();
    drawGuideArrows(timestamp);

  } else if (state.phase === 'celebrating') {
    const elapsed = timestamp - state.celebrationStart;
    drawNumber(ctx, state.currentNumber);
    updateParticles();
    drawParticles();
    drawCelebrationText(elapsed);

    if (elapsed >= CONFIG.celebrationDuration) {
      advanceNumber();
    }
  }

  requestAnimationFrame(render);
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME FLOW
// ─────────────────────────────────────────────────────────────────────────────

function checkCompletion() {
  const total = state.dots.length;
  if (total === 0) return;
  if (state.dots.filter(d => d.cleared).length / total >= CONFIG.completionThreshold) {
    celebrate();
  }
}

function celebrate() {
  if (state.phase !== 'tracing') return;
  state.showHint = false;
  const msgs = CONFIG.celebrationMessages;
  state.celebrationMsg   = msgs[(state.currentNumber - 1) % msgs.length];
  state.celebrationStart = performance.now();
  state.phase            = 'celebrating';
  spawnParticles();
  sparkleSound.currentTime = 0;
  sparkleSound.play().catch(() => {
    // Autoplay blocked — silently ignore; sound will work after first user gesture
  });
}

function advanceNumber() {
  state.currentNumber++;
  startNumber();
}

function startNumber() {
  state.phase     = 'tracing';
  state.particles = [];
  state.trail     = [];
  state.numColor  = CONFIG.numColorPalette[(state.currentNumber - 1) % CONFIG.numColorPalette.length];
  state.dots      = generateDots(state.currentNumber);
  // Pre-group dots by digit so guide arrows can track each digit's frontier independently
  const nDigits          = String(state.currentNumber).length;
  state.digitDotGroups   = Array.from({ length: nDigits }, () => []);
  for (const dot of state.dots) {
    state.digitDotGroups[dot.digitIndex].push(dot);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT HANDLING
// ─────────────────────────────────────────────────────────────────────────────

function toLogicalPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function processMove(lx, ly) {
  if (state.phase !== 'tracing') return;

  state.trail.push({ x: lx, y: ly });
  if (state.trail.length > CONFIG.trailLength) state.trail.shift();

  const rSq = CONFIG.touchRadius * CONFIG.touchRadius;
  let anyCleared = false;

  for (const dot of state.dots) {
    if (dot.cleared) continue;
    const dx = dot.x - lx;
    const dy = dot.y - ly;
    if (dx * dx + dy * dy <= rSq) {
      dot.cleared = true;
      anyCleared  = true;
    }
  }

  if (anyCleared) checkCompletion();
}

function onTouchMove(e) {
  e.preventDefault();
  if (state.activeMode === 'alphabet') {
    if (!state.abc.dragging) return;
    const t = e.changedTouches[0];
    const p = toLogicalPoint(t.clientX, t.clientY);
    state.abc.tileX = p.x - state.abc.dragOffX;
    state.abc.tileY = p.y - state.abc.dragOffY;
    return;
  }
  for (const touch of e.changedTouches) {
    const p = toLogicalPoint(touch.clientX, touch.clientY);
    processMove(p.x, p.y);
  }
}

function onTouchStart(e) {
  if (state.activeMode === 'alphabet') {
    const t = e.changedTouches[0];
    const p = toLogicalPoint(t.clientX, t.clientY);
    _abcPointerDown(p.x, p.y);
    return;
  }
}

function onTouchEnd() {
  if (state.activeMode === 'alphabet') {
    _abcPointerUp();
    return;
  }
  state.trail = [];
}

function _abcPointerDown(px, py) {
  const abc = state.abc;
  if (abc.phase !== 'playing' || abc.placed) return;
  if (px >= abc.tileX && px <= abc.tileX + abc.tileW &&
      py >= abc.tileY && py <= abc.tileY + abc.tileH) {
    abc.dragging = true;
    abc.dragOffX = px - abc.tileX;
    abc.dragOffY = py - abc.tileY;
  }
}

function _abcPointerUp() {
  const abc = state.abc;
  if (!abc.dragging) return;
  abc.dragging = false;

  // Check if tile overlaps drop zone
  const tileCx = abc.tileX + abc.tileW / 2;
  const tileCy = abc.tileY + abc.tileH / 2;
  const dropCx = abc.dropX + abc.dropW / 2;
  const dropCy = abc.dropY + abc.dropH / 2;
  const dist   = Math.hypot(tileCx - dropCx, tileCy - dropCy);

  if (dist < abc.dropW * 1.2) {
    // Successful drop!
    abc.placed = true;
    abc.tileX  = abc.dropX;
    abc.tileY  = abc.dropY;
    _abcCelebrate();
  } else {
    // Snap back to home
    abc.tileX = abc.tileHomeX;
    abc.tileY = abc.tileHomeY;
  }
}

function onMouseMove(e) {
  if (state.activeMode === 'alphabet') {
    if (!state.abc.dragging) return;
    const p = toLogicalPoint(e.clientX, e.clientY);
    state.abc.tileX = p.x - state.abc.dragOffX;
    state.abc.tileY = p.y - state.abc.dragOffY;
    return;
  }
  if (!state.isPointerDown) return;
  const { x, y } = toLogicalPoint(e.clientX, e.clientY);
  processMove(x, y);
}

function onMouseDown(e) {
  if (state.activeMode === 'alphabet') {
    const p = toLogicalPoint(e.clientX, e.clientY);
    _abcPointerDown(p.x, p.y);
    return;
  }
  state.isPointerDown = true;
  const { x, y } = toLogicalPoint(e.clientX, e.clientY);
  processMove(x, y);
}

function onMouseUp() {
  if (state.activeMode === 'alphabet') {
    _abcPointerUp();
    return;
  }
  state.isPointerDown = false;
  state.trail = [];
}

canvas.addEventListener('touchstart',  onTouchStart, { passive: true  });
canvas.addEventListener('touchmove',   onTouchMove,  { passive: false });
canvas.addEventListener('touchend',    onTouchEnd,   { passive: true  });
canvas.addEventListener('touchcancel', onTouchEnd,   { passive: true  });
canvas.addEventListener('mousedown',   onMouseDown,  { passive: true  });
canvas.addEventListener('mousemove',   onMouseMove,  { passive: true  });
canvas.addEventListener('mouseup',     onMouseUp,    { passive: true  });

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  resizeCanvas();
  if (state.activeMode === 'alphabet') {
    _setupAbcRound();
  } else {
    startNumber();
  }
});

async function init() {
  resizeCanvas();
  await document.fonts.ready;

  // Wire up mode-bar buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  startNumber();
  requestAnimationFrame(render);
}

function setMode(modeId) {
  if (!GAME_MODES[modeId] || !GAME_MODES[modeId].enabled) return;
  clickSound.currentTime = 0;
  clickSound.play().catch(() => {});
  state.activeMode = modeId;

  // Update active button highlight
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === modeId);
  });

  // Reset game state for the new mode
  if (modeId === 'numbers') {
    state.currentNumber = 1;
    startNumber();
  } else if (modeId === 'alphabet') {
    startAlphabetMode();
  }
}

init();
