// A photo on a canvas that you can tap or drag on to pick colours.
//
// Each photo is kept at two sizes:
//   work    - at most 400 px on the long side. All colour sampling
//             reads from this one, so it stays fast on large photos.
//   display - at most 800 px, so the on-screen photo stays sharp on
//             high-density phone screens. Selection marks are drawn
//             here, never on the work copy.

import { dominantColour, labToHex } from "./color.js";

const WORK_MAX = 400;
const DISPLAY_MAX = 800;

// Tap samples a circle this many work pixels across the radius.
const TAP_RADIUS = 10;
// A finger has to move this many screen pixels before a tap becomes a drag.
const DRAG_THRESHOLD = 10;
// Boxes smaller than this (in work pixels) are treated as a tap.
const MIN_BOX = 6;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = url;
  });
}

function scaledCanvas(img, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export class PhotoPicker {
  // maxPicks: how many colours can be picked at once. 0 turns picking off.
  // replaceWhenFull: when the limit is reached, a new pick replaces the
  // oldest (true) or is refused and onFull is called (false).
  constructor(canvas, { maxPicks = 1, replaceWhenFull = true, onChange = () => {}, onFull = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.maxPicks = maxPicks;
    this.replaceWhenFull = replaceWhenFull;
    this.onChange = onChange;
    this.onFull = onFull;
    this.work = null;
    this.workCtx = null;
    this.base = null;
    this.picks = [];
    this.gesture = null;

    canvas.addEventListener("pointerdown", (e) => this.#down(e));
    canvas.addEventListener("pointermove", (e) => this.#move(e));
    canvas.addEventListener("pointerup", (e) => this.#up(e));
    canvas.addEventListener("pointercancel", () => this.#cancel());
  }

  // Decode a photo file and show it. Modern browsers apply the photo's
  // EXIF rotation when drawing, so portrait shots stay upright.
  async load(file) {
    const url = URL.createObjectURL(file);
    let img;
    try {
      img = await loadImage(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    this.work = scaledCanvas(img, WORK_MAX);
    this.workCtx = this.work.getContext("2d", { willReadFrequently: true });
    this.base = scaledCanvas(img, DISPLAY_MAX);
    this.canvas.width = this.base.width;
    this.canvas.height = this.base.height;
    this.picks = [];
    this.gesture = null;
    this.#redraw();
    this.onChange(this.picks);
  }

  clearPicks() {
    this.picks = [];
    this.#redraw();
    this.onChange(this.picks);
  }

  removePick(index) {
    this.picks.splice(index, 1);
    this.#redraw();
    this.onChange(this.picks);
  }

  // A square JPEG thumbnail, cropped around the first pick so the grid
  // shows the fabric rather than the background.
  thumbnail(size = 150) {
    const { width: w, height: h } = this.work;
    const side = Math.min(w, h);
    const centre = this.picks[0] ? shapeCentre(this.picks[0].shape) : { x: w / 2, y: h / 2 };
    const sx = clamp(centre.x - side / 2, 0, w - side);
    const sy = clamp(centre.y - side / 2, 0, h - side);

    const out = document.createElement("canvas");
    out.width = size;
    out.height = size;
    // Crop from the sharper display copy, scaled into its coordinates.
    const kx = this.base.width / w;
    const ky = this.base.height / h;
    out.getContext("2d").drawImage(this.base, sx * kx, sy * ky, side * kx, side * ky, 0, 0, size, size);
    return out.toDataURL("image/jpeg", 0.8);
  }

  // ---------------------------------------------------------------
  // Pointer handling
  // ---------------------------------------------------------------
  #toWork(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clamp(((e.clientX - rect.left) / rect.width) * this.work.width, 0, this.work.width),
      y: clamp(((e.clientY - rect.top) / rect.height) * this.work.height, 0, this.work.height),
    };
  }

  #down(e) {
    if (!this.work || this.maxPicks === 0 || !e.isPrimary) return;
    // Capture keeps a drag tracking when the finger slides off the
    // photo. It can throw for pointers the browser no longer tracks;
    // picking still works without it.
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {}
    this.gesture = {
      start: this.#toWork(e),
      current: null,
      clientX: e.clientX,
      clientY: e.clientY,
      dragging: false,
    };
  }

  #move(e) {
    const g = this.gesture;
    if (!g) return;
    if (!g.dragging && Math.hypot(e.clientX - g.clientX, e.clientY - g.clientY) > DRAG_THRESHOLD) {
      g.dragging = true;
    }
    if (g.dragging) {
      g.current = this.#toWork(e);
      this.#redraw();
    }
  }

  #up(e) {
    const g = this.gesture;
    if (!g) return;
    this.gesture = null;

    let shape;
    if (g.dragging) {
      const end = this.#toWork(e);
      const box = {
        type: "box",
        x: Math.min(g.start.x, end.x),
        y: Math.min(g.start.y, end.y),
        w: Math.abs(end.x - g.start.x),
        h: Math.abs(end.y - g.start.y),
      };
      if (box.w >= MIN_BOX && box.h >= MIN_BOX) shape = box;
    }
    if (!shape) shape = { type: "circle", x: g.start.x, y: g.start.y, r: TAP_RADIUS };

    if (this.picks.length >= this.maxPicks && !this.replaceWhenFull) {
      this.#redraw(); // clear the drag box
      this.onFull();
      return;
    }

    const lab = dominantColour(this.#pixelsIn(shape));
    if (lab) {
      this.picks.push({ shape, lab, hex: labToHex(lab) });
      if (this.picks.length > this.maxPicks) this.picks.shift();
      this.onChange(this.picks);
    }
    this.#redraw();
  }

  #cancel() {
    this.gesture = null;
    this.#redraw();
  }

  // ---------------------------------------------------------------
  // Sampling
  // ---------------------------------------------------------------
  #pixelsIn(shape) {
    const W = this.work.width;
    const H = this.work.height;
    let x0, y0, x1, y1;
    if (shape.type === "circle") {
      x0 = shape.x - shape.r;
      y0 = shape.y - shape.r;
      x1 = shape.x + shape.r;
      y1 = shape.y + shape.r;
    } else {
      x0 = shape.x;
      y0 = shape.y;
      x1 = shape.x + shape.w;
      y1 = shape.y + shape.h;
    }
    x0 = clamp(Math.floor(x0), 0, W - 1);
    y0 = clamp(Math.floor(y0), 0, H - 1);
    x1 = clamp(Math.ceil(x1), x0 + 1, W);
    y1 = clamp(Math.ceil(y1), y0 + 1, H);

    const data = this.workCtx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    if (shape.type === "box") return data;

    // Keep only the pixels inside the circle.
    const out = [];
    const r2 = shape.r * shape.r;
    const width = x1 - x0;
    for (let i = 0; i < data.length; i += 4) {
      const px = x0 + ((i / 4) % width) + 0.5;
      const py = y0 + Math.floor(i / 4 / width) + 0.5;
      if ((px - shape.x) ** 2 + (py - shape.y) ** 2 <= r2) {
        out.push(data[i], data[i + 1], data[i + 2], data[i + 3]);
      }
    }
    // A tap right at a corner can leave the circle with no pixel centres
    // inside it; fall back to the whole square in that case.
    return out.length ? Uint8ClampedArray.from(out) : data;
  }

  // ---------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------
  #redraw() {
    if (!this.base) return;
    const ctx = this.ctx;
    ctx.drawImage(this.base, 0, 0);

    const k = this.base.width / this.work.width; // work px -> display px
    const rect = this.canvas.getBoundingClientRect();
    // Keep marks about 2 screen pixels thick whatever the zoom.
    const px = rect.width ? this.canvas.width / rect.width : 1;

    this.picks.forEach((pick, i) => {
      drawMark(ctx, pick.shape, k, px);
      if (this.maxPicks > 1) drawLabel(ctx, pick.shape, k, px, String(i + 1));
    });

    const g = this.gesture;
    if (g?.dragging && g.current) {
      drawMark(ctx, {
        type: "box",
        x: Math.min(g.start.x, g.current.x),
        y: Math.min(g.start.y, g.current.y),
        w: Math.abs(g.current.x - g.start.x),
        h: Math.abs(g.current.y - g.start.y),
      }, k, px);
    }
  }
}

// A white line over a dark line, so the mark shows on any colour.
function drawMark(ctx, shape, k, px) {
  const path = new Path2D();
  if (shape.type === "circle") {
    path.arc(shape.x * k, shape.y * k, shape.r * k, 0, Math.PI * 2);
  } else {
    path.rect(shape.x * k, shape.y * k, shape.w * k, shape.h * k);
  }
  ctx.lineWidth = 4 * px;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
  ctx.stroke(path);
  ctx.lineWidth = 2 * px;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke(path);
}

// A numbered badge at the mark's top-right corner, so it labels the
// mark without hiding the area that was sampled. Kept inside the photo.
function drawLabel(ctx, shape, k, px, text) {
  const r = 10 * px;
  let x, y;
  if (shape.type === "circle") {
    const d = shape.r * k * Math.SQRT1_2;
    x = shape.x * k + d + r * 0.6;
    y = shape.y * k - d - r * 0.6;
  } else {
    x = (shape.x + shape.w) * k;
    y = shape.y * k;
  }
  x = clamp(x, r, ctx.canvas.width - r);
  y = clamp(y, r, ctx.canvas.height - r);

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fill();
  ctx.lineWidth = 1.5 * px;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${12 * px}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 0.5 * px);
}

function shapeCentre(shape) {
  return shape.type === "circle"
    ? { x: shape.x, y: shape.y }
    : { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 };
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
