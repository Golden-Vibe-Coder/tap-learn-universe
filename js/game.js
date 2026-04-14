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

  // Spacing between dots along the path (canvas pixels)
  dotSpacing: 32,

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
  alphabet: { label: 'Alphabet', icon: 'ABC', enabled: false },
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
    { t: 'C', x1: 56, y1: 60,  x2: 16, y2: 68, x: 12, y: 88  },
  ]],

  7: [
    [
      { t: 'M', x: 14, y: 16 },
      { t: 'L', x: 82, y: 16 },
      { t: 'L', x: 38, y: 126 },
    ],
    // cross-stroke
    [
      { t: 'M', x: 44, y: 74 },
      { t: 'L', x: 68, y: 74 },
    ],
  ],

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
      const dense   = expandSubpath(subpath, layout.scale, ox, oy);
      const sampled = sampleEvenSpacing(dense, CONFIG.dotSpacing);
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
  const n     = Math.max(2, Math.floor(bw / 15));
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
  const n     = Math.max(2, Math.floor(bw / 15));
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

function _drawJar(g, x, y, w, h, lidColor, ballColors, seed, candyType) {
  const rng  = _rng(seed);
  const lidH = h * 0.14;
  const bx   = x + 4, bw = w - 8;
  const by   = y + lidH, bh = h * 0.78;
  const br   = w * 0.12;

  g.save();
  g.beginPath();
  g.roundRect(bx, by, bw, bh, [br, br, br * 2.5, br * 2.5]);
  g.clip();
  g.fillStyle = lidColor + '55';
  g.fillRect(bx, by, bw, bh);
  if      (candyType === 1) _drawLollipops(g,  bx, by, bw, bh, ballColors, rng);
  else if (candyType === 2) _drawCandyCanes(g, bx, by, bw, bh, rng);
  else                      _drawGumballs(g,   bx, by, bw, bh, ballColors, rng);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(bx, by, bw * 0.22, bh);
  g.restore();

  g.save();
  g.beginPath();
  g.roundRect(bx, by, bw, bh, [br, br, br * 2.5, br * 2.5]);
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth   = 2;
  g.stroke();
  g.restore();

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

  // Sign shadow + body
  g.save();
  g.shadowColor   = 'rgba(0,0,0,0.38)';
  g.shadowBlur    = 18;
  g.shadowOffsetY = 5;
  g.beginPath();
  g.roundRect(sx, sy, signW, signH, 10);
  g.fillStyle = '#4a2408';
  g.fill();
  g.restore();

  // Inner gold border
  g.save();
  g.beginPath();
  g.roundRect(sx + 4, sy + 4, signW - 8, signH - 8, 7);
  g.strokeStyle = '#c8893a';
  g.lineWidth   = 2.5;
  g.stroke();
  g.restore();

  // Sign text
  const fontSize = Math.max(18, signH * 0.44);
  g.save();
  g.font         = `bold ${fontSize}px "Fredoka One", sans-serif`;
  g.textAlign    = 'center';
  g.textBaseline = 'middle';
  g.shadowColor  = 'rgba(0,0,0,0.55)';
  g.shadowBlur   = 5;
  g.fillStyle    = '#ffd700';
  g.fillText('Candy Shop', sx + signW / 2, sy + signH / 2, signW - 60);
  g.restore();

  // Gold stars flanking the text (drawn after text so they always appear on top)
  g.fillStyle = '#ffd700';
  _star(g, sx + 14, sy + signH / 2, 8);
  g.fill();
  _star(g, sx + signW - 14, sy + signH / 2, 8);
  g.fill();
}

function _drawCandyStore(g, w, h) {
  const JAR_COLORS  = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#3498db','#9b59b6','#e91e63','#1abc9c'];
  const BALL_COLORS = ['#ff6b6b','#ff9f40','#ffdd59','#badc58','#7ed6df','#a29bfe','#fd79a8','#74b9ff'];
  const CANDY_TYPES = [0, 1, 2, 0, 1, 0, 2, 1]; // 0=gumballs 1=lollipops 2=candy canes
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

  // Three shelves with varied jar heights and candy types
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
    // Underside shadow strip
    g.fillStyle = 'rgba(0,0,0,0.10)';
    g.fillRect(0, sy + shH, w, 8);
    // Top highlight
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.fillRect(0, sy, w, 3);

    // Shelf brackets
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
      _drawJar(g, ox + j * (jarW + gap), sy - jarH, jarW, jarH,
               JAR_COLORS[ci], BALL_COLORS, si * 50 + j + 1, candyType);
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
  if (!bgCache) _buildBgCache();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bgCache, 0, 0);
  ctx.restore();
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
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(0, 0, cw, ch);

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
  for (const touch of e.changedTouches) {
    const p = toLogicalPoint(touch.clientX, touch.clientY);
    processMove(p.x, p.y);
  }
}

function onTouchEnd()  { state.trail = []; }

function onMouseMove(e) {
  if (!state.isPointerDown) return;
  const { x, y } = toLogicalPoint(e.clientX, e.clientY);
  processMove(x, y);
}

function onMouseDown(e) {
  state.isPointerDown = true;
  const { x, y } = toLogicalPoint(e.clientX, e.clientY);
  processMove(x, y);
}

function onMouseUp() {
  state.isPointerDown = false;
  state.trail = [];
}

canvas.addEventListener('touchmove',   onTouchMove, { passive: false });
canvas.addEventListener('touchend',    onTouchEnd,  { passive: true  });
canvas.addEventListener('touchcancel', onTouchEnd,  { passive: true  });
canvas.addEventListener('mousedown',   onMouseDown, { passive: true  });
canvas.addEventListener('mousemove',   onMouseMove, { passive: true  });
canvas.addEventListener('mouseup',     onMouseUp,   { passive: true  });

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  resizeCanvas();
  startNumber();
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
  }
  // Future modes: else if (modeId === 'alphabet') { ... }
}

init();
