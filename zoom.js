// Full-screen zoom view for picking small details precisely.
//
// The photo is shown from the picker's 1600 px detail copy at 1x to 4x.
// Dragging scrolls around (the browser handles it, so it feels native);
// a tap without movement picks the colour of that exact spot.

const LEVELS = [1, 2, 3, 4];
const START_LEVEL = 2;
// Zoomed taps sample a circle this many screen pixels across the radius.
const PRECISE_RADIUS = 4;
// More movement than this (screen pixels) means the finger was scrolling.
const TAP_SLOP = 8;

export class ZoomViewer {
  constructor({ dialog, scroller, canvas, title, status, level, zoomIn, zoomOut, done }) {
    Object.assign(this, { dialog, scroller, canvas, title, status, level, zoomIn, zoomOut, done });
    this.ctx = canvas.getContext("2d");
    this.picker = null;
    this.describe = null;
    this.levelIndex = LEVELS.indexOf(START_LEVEL);
    this.tap = null;

    zoomIn.addEventListener("click", () => this.#setLevel(this.levelIndex + 1));
    zoomOut.addEventListener("click", () => this.#setLevel(this.levelIndex - 1));
    done.addEventListener("click", () => dialog.close());
    window.addEventListener("resize", () => {
      if (dialog.open) this.#layout({ keepCentre: true });
    });

    canvas.addEventListener("pointerdown", (e) => {
      if (!e.isPrimary) return;
      this.tap = { x: e.clientX, y: e.clientY, moved: false };
    });
    canvas.addEventListener("pointermove", (e) => {
      if (this.tap && Math.hypot(e.clientX - this.tap.x, e.clientY - this.tap.y) > TAP_SLOP) {
        this.tap.moved = true;
      }
    });
    // The browser cancels the pointer when it takes over for scrolling.
    canvas.addEventListener("pointercancel", () => (this.tap = null));
    canvas.addEventListener("pointerup", (e) => {
      const tap = this.tap;
      this.tap = null;
      if (!tap || tap.moved) return;
      this.#pick(e);
    });
  }

  // picker: the PhotoPicker whose photo to show.
  // describe(result, picker): the status line to show after a pick.
  open(picker, { title, hint, describe }) {
    if (!picker.detail) return;
    this.picker = picker;
    this.describe = describe;
    this.title.textContent = title;
    this.status.textContent = hint;
    this.canvas.width = picker.detail.width;
    this.canvas.height = picker.detail.height;
    this.levelIndex = LEVELS.indexOf(START_LEVEL);
    this.dialog.showModal();
    this.#layout({ keepCentre: false });
  }

  #setLevel(index) {
    const next = Math.min(LEVELS.length - 1, Math.max(0, index));
    if (next === this.levelIndex) return;
    this.levelIndex = next;
    this.#layout({ keepCentre: true });
  }

  // Size the photo for the current zoom level and redraw it.
  #layout({ keepCentre }) {
    const sc = this.scroller;
    const oldW = this.canvas.offsetWidth || 1;
    const oldH = this.canvas.offsetHeight || 1;
    const centreX = (sc.scrollLeft + sc.clientWidth / 2) / oldW;
    const centreY = (sc.scrollTop + sc.clientHeight / 2) / oldH;

    // 1x fits the whole photo on screen.
    const { width: dw, height: dh } = this.picker.detail;
    const fit = Math.min(sc.clientWidth / dw, sc.clientHeight / dh);
    const level = LEVELS[this.levelIndex];
    const w = Math.round(dw * fit * level);
    const h = Math.round(dh * fit * level);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    const cx = keepCentre ? centreX : 0.5;
    const cy = keepCentre ? centreY : 0.5;
    sc.scrollLeft = cx * w - sc.clientWidth / 2;
    sc.scrollTop = cy * h - sc.clientHeight / 2;

    this.level.textContent = `${level}×`;
    this.zoomOut.disabled = this.levelIndex === 0;
    this.zoomIn.disabled = this.levelIndex === LEVELS.length - 1;
    this.#redraw();
  }

  #redraw() {
    const detail = this.picker.detail;
    this.ctx.drawImage(detail, 0, 0);
    const shown = this.canvas.offsetWidth || detail.width;
    const px = detail.width / shown; // canvas pixels per screen pixel
    const k = detail.width / this.picker.work.width; // work px -> canvas px
    this.picker.drawMarks(this.ctx, k, px);
  }

  #pick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scale = this.canvas.width / rect.width; // canvas px per screen px
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    // Never sample less than a couple of photo pixels, even at 4x.
    const r = Math.max(1.5, PRECISE_RADIUS * scale);
    const result = this.picker.pickPrecise(x, y, r);
    this.status.textContent = this.describe(result, this.picker);
    this.#redraw();
  }
}
