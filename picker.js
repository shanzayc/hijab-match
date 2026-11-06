// A photo on a canvas that you can tap or drag on to pick colours.
//
// Each photo is kept at three sizes:
//   work    - at most 400 px on the long side. Normal taps and drags
//             sample from this one, so they stay fast on large photos.
//   display - at most 800 px, so the on-screen photo stays sharp on
//             high-density phone screens. Selection marks are drawn
//             here, never on the work copy.
//   detail  - at most 1600 px, for the zoom view. Small details such
//             as dots in a pattern survive at this size, and zoomed-in
//             picks sample from it.
//
// Lighting correction: tapping something that should be white or light
// grey sets a white point. All three copies are rebuilt from untouched
// originals with each colour channel scaled so that spot becomes
// neutral (the same idea as a camera's white balance), and existing
// picks are re-read from the corrected photo.

import { dominantColour, labToHex, rgbToLab, srgbToLinear, linearToSrgb } from "./color.js";

const WORK_MAX = 400;
const DISPLAY_MAX = 800;
const DETAIL_MAX = 1600;

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

// Scale so the long side is exactly maxSide. Large photos shrink; small
// images (such as a saved 150 px thumbnail being re-picked) are enlarged
// so they show at a usable size and taps cover the same share of the
// picture as on a full photo.
// Lookup tables for fast white balance over millions of pixels.
const TO_LINEAR = Float32Array.from({ length: 256 }, (_, i) => srgbToLinear(i));
const STEPS = 4096;
const TO_SRGB = Uint8ClampedArray.from({ length: STEPS + 1 }, (_, i) => linearToSrgb(i / STEPS));

function copyCanvas(src) {
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  out.getContext("2d").drawImage(src, 0, 0);
  return out;
}

// Redraw dst from src, scaling each channel in linear light by gains.
function applyGains(src, dst, gains) {
  const ctx = dst.getContext("2d");
  ctx.drawImage(src, 0, 0);
  if (!gains) return;
  const img = ctx.getImageData(0, 0, dst.width, dst.height);
  const d = img.data;
  const [gr, gg, gb] = gains;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = TO_SRGB[Math.min(STEPS, Math.round(TO_LINEAR[d[i]] * gr * STEPS))];
    d[i + 1] = TO_SRGB[Math.min(STEPS, Math.round(TO_LINEAR[d[i + 1]] * gg * STEPS))];
    d[i + 2] = TO_SRGB[Math.min(STEPS, Math.round(TO_LINEAR[d[i + 2]] * gb * STEPS))];
  }
  ctx.putImageData(img, 0, 0);
}

function scaledCanvas(img, maxSide) {
  const scale = maxSide / Math.max(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export class PhotoPicker {
  // maxPicks: how many colours can be picked at once. 0 turns picking off.
  // replaceWhenFull: when the limit is reached, a new pick replaces the
  // oldest (true) or is refused and onFull is called (false).
  // onWhite(result) reports a lighting-correction tap: "ok", "too-dark"
  // or "too-colourful".
  constructor(
    canvas,
    { maxPicks = 1, replaceWhenFull = true, onChange = () => {}, onFull = () => {}, onWhite = () => {} } = {}
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.maxPicks = maxPicks;
    this.replaceWhenFull = replaceWhenFull;
    this.onChange = onChange;
    this.onFull = onFull;
    this.onWhite = onWhite;
    this.choosingWhite = false;
    this.whiteGains = null;
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

  // Decode a photo file (or any image Blob) and show it. Modern browsers
  // apply the photo's EXIF rotation when drawing, so portrait shots stay
  // upright.
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
    this.detail = scaledCanvas(img, DETAIL_MAX);
    this.detailCtx = this.detail.getContext("2d", { willReadFrequently: true });
    this.originals = { work: copyCanvas(this.work), base: copyCanvas(this.base), detail: copyCanvas(this.detail) };
    this.whiteGains = null;
    this.choosingWhite = false;
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

  // ---------------------------------------------------------------
  // Lighting correction
  // ---------------------------------------------------------------
  // The next tap marks something that should be white or light grey.
  chooseWhite(on) {
    this.choosingWhite = Boolean(on && this.work);
  }

  get lightingFixed() {
    return this.whiteGains !== null;
  }

  clearWhite() {
    this.choosingWhite = false;
    if (!this.whiteGains) return;
    this.whiteGains = null;
    this.#rebuild();
  }

  #setWhiteFrom(shape) {
    const o = this.originals.work;
    const data = pixelsIn(o.getContext("2d"), o.width, o.height, shape);
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += TO_LINEAR[data[i]];
      g += TO_LINEAR[data[i + 1]];
      b += TO_LINEAR[data[i + 2]];
      n++;
    }
    r /= n; g /= n; b /= n;
    const [L, a, bb] = rgbToLab(linearToSrgb(r), linearToSrgb(g), linearToSrgb(b));
    // Too dark to judge the light by, or so colourful it can't have
    // been white or grey under any normal lighting.
    if (L < 35) return "too-dark";
    if (Math.hypot(a, bb) > 40) return "too-colourful";
    const avg = (r + g + b) / 3;
    const limit = (x) => Math.min(2, Math.max(0.5, x));
    this.whiteGains = [limit(avg / r), limit(avg / g), limit(avg / b)];
    this.#rebuild();
    return "ok";
  }

  // Rebuild the three copies from the originals with the current white
  // point, then re-read every pick from the corrected photo.
  #rebuild() {
    applyGains(this.originals.work, this.work, this.whiteGains);
    applyGains(this.originals.base, this.base, this.whiteGains);
    applyGains(this.originals.detail, this.detail, this.whiteGains);
    for (const pick of this.picks) {
      const lab = pick.precise ? this.#samplePrecise(pick.shape) : this.#sampleWork(pick.shape);
      if (lab) {
        pick.lab = lab;
        pick.hex = labToHex(lab);
      }
    }
    this.#redraw();
    this.onChange(this.picks);
  }

  #sampleWork(shape) {
    return dominantColour(pixelsIn(this.workCtx, this.work.width, this.work.height, shape));
  }

  // shape in work pixels; samples the detail copy around its centre.
  #samplePrecise(shape) {
    const W = this.detail.width;
    const H = this.detail.height;
    const k = W / this.work.width;
    const x = shape.x * k;
    const y = shape.y * k;
    const [cr, cg, cb] = this.detailCtx
      .getImageData(clamp(Math.floor(x), 0, W - 1), clamp(Math.floor(y), 0, H - 1), 1, 1).data;
    const pixels = pixelsIn(this.detailCtx, W, H, { type: "circle", x, y, r: shape.r * k });
    return dominantColour(pixels, { centre: rgbToLab(cr, cg, cb) });
  }

  // Index of the pick whose mark covers a point given in work pixels,
  // or -1. minR is the smallest radius (work pixels) a mark is drawn at.
  pickAt(x, y, minR = 0) {
    for (let i = this.picks.length - 1; i >= 0; i--) {
      const s = this.picks[i].shape;
      if (s.type === "circle") {
        if (Math.hypot(x - s.x, y - s.y) <= Math.max(s.r, minR)) return i;
      } else if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
        return i;
      }
    }
    return -1;
  }

  // A precise pick from the zoom view, in detail-copy pixels. Samples a
  // small circle and keeps the colour of the exact spot tapped, even
  // when it isn't the most common colour around it.
  // Returns "added", "full" (limit reached, nothing changed) or "none".
  pickPrecise(x, y, r) {
    if (!this.detail) return "none";
    if (this.picks.length >= this.maxPicks && !this.replaceWhenFull) {
      this.onFull();
      return "full";
    }
    // Store the shape in work pixels, like every other pick.
    const k = this.detail.width / this.work.width;
    const shape = { type: "circle", x: x / k, y: y / k, r: r / k };
    const lab = this.#samplePrecise(shape);
    if (!lab) return "none";
    return this.#addPick(shape, lab, true);
  }

  // Draw every pick's mark (and number, when several are allowed) onto
  // another canvas. k converts work pixels to that canvas's pixels; px is
  // that canvas's pixels per screen pixel.
  // minR is the smallest radius, in screen pixels, a circle is drawn at.
  drawMarks(ctx, k, px, minR = 6) {
    this.picks.forEach((pick, i) => {
      drawMark(ctx, pick.shape, k, px, minR);
      if (this.maxPicks > 1) drawLabel(ctx, pick.shape, k, px, String(i + 1), minR);
    });
  }

  #addPick(shape, lab, precise = false) {
    if (this.picks.length >= this.maxPicks && !this.replaceWhenFull) {
      this.#redraw(); // clear any drag box
      this.onFull();
      return "full";
    }
    this.picks.push({ shape, lab, hex: labToHex(lab), precise });
    if (this.picks.length > this.maxPicks) this.picks.shift();
    this.#redraw();
    this.onChange(this.picks);
    return "added";
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

    if (this.choosingWhite) {
      const result = this.#setWhiteFrom(shape);
      if (result === "ok") this.choosingWhite = false;
      else this.#redraw(); // clear any drag box
      this.onWhite(result);
      return;
    }

    if (this.picks.length >= this.maxPicks && !this.replaceWhenFull) {
      this.#redraw(); // clear the drag box
      this.onFull();
      return;
    }

    const lab = this.#sampleWork(shape);
    if (lab) this.#addPick(shape, lab);
    else this.#redraw();
  }

  #cancel() {
    this.gesture = null;
    this.#redraw();
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

    this.drawMarks(ctx, k, px);

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

// The pixels of a canvas inside a circle or box, as RGBA.
function pixelsIn(ctx, W, H, shape) {
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

  const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
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

// A white line over a dark line, so the mark shows on any colour.
// Circles are drawn at least minR screen pixels across the radius so tiny
// precise picks stay visible.
function drawMark(ctx, shape, k, px, minR = 6) {
  const path = new Path2D();
  if (shape.type === "circle") {
    path.arc(shape.x * k, shape.y * k, Math.max(shape.r * k, minR * px), 0, Math.PI * 2);
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
function drawLabel(ctx, shape, k, px, text, minR = 6) {
  const r = 10 * px;
  let x, y;
  if (shape.type === "circle") {
    const d = Math.max(shape.r * k, minR * px) * Math.SQRT1_2;
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
