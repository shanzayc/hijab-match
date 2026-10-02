// Screens, navigation, and the closet.
// All image work happens on this device: photos are decoded in the
// browser and drawn onto a canvas, and nothing is uploaded.

import { PhotoPicker } from "./picker.js";
import { loadCloset, saveCloset, newId } from "./storage.js";
import { suggestName } from "./names.js";
import { rankCloset } from "./match.js";
import { ZoomViewer } from "./zoom.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const scrollBehavior = reduceMotion ? "auto" : "smooth";

const screens = {
  closet: document.getElementById("closetScreen"),
  match: document.getElementById("matchScreen"),
};
const tabs = document.querySelectorAll(".tab");
const photoError = document.getElementById("photoError");

// ---------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------
function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.hidden = key !== name;
  }
  for (const tab of tabs) {
    const active = tab.dataset.screen === name;
    tab.classList.toggle("is-active", active);
    if (active) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  }
  if (name === "match") {
    updateMatchNotice();
    // The closet may have changed on the other tab.
    if (!results.hidden) renderResults();
  }
  window.scrollTo({ top: 0 });
}

for (const tab of tabs) {
  tab.addEventListener("click", () => showScreen(tab.dataset.screen));
}

// ---------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------
let errorTimer;
function showError(message) {
  photoError.textContent = message;
  photoError.hidden = false;
  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => (photoError.hidden = true), 5000);
}

// Wire a camera input and a gallery input to the same picker.
// onLoaded runs after the photo is on screen.
function wirePhotoInputs(inputs, picker, onLoaded) {
  for (const input of inputs) {
    input.addEventListener("change", async () => {
      const file = input.files[0];
      // Reset so picking the same photo again still fires "change".
      input.value = "";
      if (!file) return;
      try {
        await picker.load(file);
        onLoaded();
      } catch {
        showError("That photo couldn't be opened. Try a JPEG or PNG.");
      }
    });
  }
}

function roundLab(lab) {
  return lab.map((v) => Math.round(v * 100) / 100);
}

// ---------------------------------------------------------------
// Zoom view, shared by the closet and outfit photos
// ---------------------------------------------------------------
const zoom = new ZoomViewer({
  dialog: document.getElementById("zoomDialog"),
  scroller: document.getElementById("zoomScroller"),
  canvas: document.getElementById("zoomCanvas"),
  title: document.getElementById("zoomTitle"),
  status: document.getElementById("zoomStatus"),
  level: document.getElementById("zoomLevel"),
  zoomIn: document.getElementById("zoomIn"),
  zoomOut: document.getElementById("zoomOut"),
  done: document.getElementById("zoomDone"),
});

// ---------------------------------------------------------------
// Closet: adding a hijab
// ---------------------------------------------------------------
let closet = loadCloset();

const closetSub = document.getElementById("closetSub");
const closetEmpty = document.getElementById("closetEmpty");
const closetGrid = document.getElementById("closetGrid");
const addPanel = document.getElementById("addPanel");
const pickHint = document.getElementById("pickHint");
const pickResult = document.getElementById("pickResult");
const pickSwatch = document.getElementById("pickSwatch");
const pickHex = document.getElementById("pickHex");
const hijabName = document.getElementById("hijabName");
const addSave = document.getElementById("addSave");

// The name field is filled with a suggestion from the colour. Once you
// type in it, re-picking the colour no longer replaces what you wrote.
let nameEdited = false;
hijabName.addEventListener("input", () => {
  // Clearing the field hands it back to the suggestion.
  nameEdited = hijabName.value.trim() !== "";
});

const hijabPicker = new PhotoPicker(document.getElementById("hijabCanvas"), {
  maxPicks: 1,
  onChange(picks) {
    const pick = picks[0];
    pickResult.hidden = !pick;
    if (!pick) {
      pickHint.textContent = "Tap the fabric, or drag a box over it.";
      return;
    }
    pickSwatch.style.background = pick.hex;
    pickHex.textContent = pick.hex;
    if (!nameEdited) hijabName.value = suggestName(pick.lab);
    pickHint.textContent = "Not quite right? Tap or drag again.";
  },
});

wirePhotoInputs(
  [document.getElementById("hijabCamera"), document.getElementById("hijabGallery")],
  hijabPicker,
  () => {
    hijabName.value = "";
    nameEdited = false;
    addPanel.hidden = false;
    closetEmpty.hidden = true;
    addPanel.scrollIntoView({ behavior: scrollBehavior, block: "start" });
  }
);

function closeAddPanel() {
  addPanel.hidden = true;
  renderCloset();
}

document.getElementById("addCancel").addEventListener("click", closeAddPanel);

document.getElementById("hijabZoom").addEventListener("click", () => {
  zoom.open(hijabPicker, {
    title: "Pick the hijab's colour",
    hint: "Drag to move around. Tap the exact spot you want.",
    describe(result, picker) {
      if (result !== "added") return "Couldn't read that spot. Try another one.";
      const pick = picker.picks[0];
      return `Picked ${suggestName(pick.lab)} (${pick.hex}). Tap again to change it, or tap Done.`;
    },
  });
});

function saveNewHijab() {
  const pick = hijabPicker.picks[0];
  if (!pick) return;
  const item = {
    id: newId(),
    name: hijabName.value.trim(),
    hex: pick.hex,
    lab: roundLab(pick.lab),
    thumb: hijabPicker.thumbnail(150),
    inWash: false,
    createdAt: Date.now(),
  };
  const next = [item, ...closet];
  if (!saveCloset(next)) {
    showError("Couldn't save. This browser's storage is full or blocked. Try deleting a hijab first.");
    return;
  }
  closet = next;
  closeAddPanel();
  window.scrollTo({ top: 0, behavior: scrollBehavior });
}

addSave.addEventListener("click", saveNewHijab);
hijabName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    hijabName.blur();
    saveNewHijab();
  }
});

// ---------------------------------------------------------------
// Closet: the grid
// ---------------------------------------------------------------
function renderCloset() {
  const count = closet.length;
  closetGrid.hidden = count === 0;
  closetEmpty.hidden = count > 0 || !addPanel.hidden;
  closetSub.textContent =
    count === 0
      ? "Add each hijab once. Your photos stay on this phone."
      : `${count} ${count === 1 ? "hijab" : "hijabs"}, saved on this phone. Tap one to rename or delete it.`;

  closetGrid.replaceChildren(
    ...closet.map((item) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "tile";
      tile.addEventListener("click", () => openHijab(item.id));

      const img = document.createElement("img");
      img.src = item.thumb;
      img.alt = "";

      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = item.hex;

      const name = document.createElement("span");
      name.className = "tile-name";
      if (item.name) {
        name.textContent = item.name;
      } else {
        name.textContent = "Unnamed";
        name.classList.add("is-unnamed");
      }
      tile.setAttribute("aria-label", `${item.name || "Unnamed hijab"}, colour ${item.hex}`);

      tile.append(img, swatch, name);
      return tile;
    })
  );
}

// ---------------------------------------------------------------
// Closet: rename and delete
// ---------------------------------------------------------------
const dialog = document.getElementById("hijabDialog");
const dlgThumb = document.getElementById("dlgThumb");
const dlgSwatch = document.getElementById("dlgSwatch");
const dlgHex = document.getElementById("dlgHex");
const dlgName = document.getElementById("dlgName");
const dlgActions = document.getElementById("dlgActions");
const dlgConfirm = document.getElementById("dlgConfirm");
let editingId = null;

function openHijab(id) {
  const item = closet.find((h) => h.id === id);
  if (!item) return;
  editingId = id;
  dlgThumb.src = item.thumb;
  dlgSwatch.style.background = item.hex;
  dlgHex.textContent = item.hex;
  dlgName.value = item.name;
  // A hijab saved without a name still gets a hint from its colour.
  dlgName.placeholder = suggestName(item.lab);
  dlgActions.hidden = false;
  dlgConfirm.hidden = true;
  dialog.showModal();
}

function updateCloset(next) {
  if (!saveCloset(next)) {
    showError("Couldn't save that change. This browser's storage is full or blocked.");
    return false;
  }
  closet = next;
  renderCloset();
  return true;
}

function saveRename() {
  const name = dlgName.value.trim();
  const next = closet.map((h) => (h.id === editingId ? { ...h, name } : h));
  if (updateCloset(next)) dialog.close();
}

document.getElementById("dlgSave").addEventListener("click", saveRename);
dlgName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    saveRename();
  }
});

document.getElementById("dlgDelete").addEventListener("click", () => {
  dlgActions.hidden = true;
  dlgConfirm.hidden = false;
});

document.getElementById("dlgKeep").addEventListener("click", () => {
  dlgConfirm.hidden = true;
  dlgActions.hidden = false;
});

document.getElementById("dlgConfirmDelete").addEventListener("click", () => {
  if (updateCloset(closet.filter((h) => h.id !== editingId))) dialog.close();
});

document.getElementById("dlgClose").addEventListener("click", () => dialog.close());

// Tapping the dimmed area outside the dialog closes it. Clicks on the
// dialog's own padding also have the dialog as their target, so check
// the position rather than the target.
dialog.addEventListener("click", (e) => {
  if (e.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  if (!inside) dialog.close();
});

dialog.addEventListener("close", () => {
  editingId = null;
});

renderCloset();

// ---------------------------------------------------------------
// Match screen: picking outfit colours
// ---------------------------------------------------------------
const matchEmpty = document.getElementById("matchEmpty");
const matchNeedsCloset = document.getElementById("matchNeedsCloset");
const outfitPanel = document.getElementById("outfitPanel");
const outfitHint = document.getElementById("outfitHint");
const pieceList = document.getElementById("pieceList");
const findMatches = document.getElementById("findMatches");
const results = document.getElementById("results");
const resultsSub = document.getElementById("resultsSub");
const resultGroups = document.getElementById("resultGroups");
const seeAll = document.getElementById("seeAll");

const OUTFIT_HINT =
  "Tap up to 3 pieces, like your top or skirt. For a pattern, drag a box over it. For a tiny detail, zoom in.";
const MAX_PIECES = 3;

const outfitPicker = new PhotoPicker(document.getElementById("outfitCanvas"), {
  maxPicks: MAX_PIECES,
  replaceWhenFull: false,
  onChange: renderPieces,
  onFull() {
    outfitHint.textContent = "Up to 3 pieces. Remove one to add another.";
  },
});

function renderPieces(picks) {
  pieceList.hidden = picks.length === 0;
  findMatches.hidden = picks.length === 0;
  // Once results are showing, keep them in step with the pieces.
  if (!results.hidden) renderResults();
  outfitHint.textContent =
    picks.length < MAX_PIECES ? OUTFIT_HINT : "That's 3 pieces. Remove one to pick a different piece.";

  pieceList.replaceChildren(
    ...picks.map((pick, i) => {
      const row = document.createElement("li");
      row.className = "piece-row";

      const num = document.createElement("span");
      num.className = "piece-num";
      num.textContent = String(i + 1);
      num.setAttribute("aria-hidden", "true");

      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = pick.hex;

      const text = document.createElement("div");
      text.className = "piece-text";
      const name = document.createElement("span");
      name.className = "piece-name";
      name.textContent = suggestName(pick.lab);
      const hex = document.createElement("span");
      hex.className = "hex";
      hex.textContent = pick.hex;
      text.append(name, hex);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn-icon";
      remove.setAttribute("aria-label", `Remove piece ${i + 1}, ${name.textContent}`);
      remove.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>';
      remove.addEventListener("click", () => outfitPicker.removePick(i));

      row.append(num, swatch, text, remove);
      return row;
    })
  );
}

wirePhotoInputs(
  [document.getElementById("outfitCamera"), document.getElementById("outfitGallery")],
  outfitPicker,
  () => {
    matchEmpty.hidden = true;
    outfitPanel.hidden = false;
    outfitPanel.scrollIntoView({ behavior: scrollBehavior, block: "start" });
  }
);

document.getElementById("outfitZoom").addEventListener("click", () => {
  zoom.open(outfitPicker, {
    title: "Pick outfit colours",
    hint: "Drag to move around. Tap a piece of clothing, or a small detail like a dot in a pattern.",
    describe(result, picker) {
      if (result === "full") return "That's 3 pieces. Tap Done, then remove one to pick another.";
      if (result !== "added") return "Couldn't read that spot. Try another one.";
      const n = picker.picks.length;
      const pick = picker.picks[n - 1];
      const next = n < MAX_PIECES ? "Tap another piece, or tap Done." : "That's 3. Tap Done.";
      return `Piece ${n}: ${suggestName(pick.lab)} (${pick.hex}). ${next}`;
    },
  });
});

document.getElementById("outfitClear").addEventListener("click", () => {
  outfitPicker.clearPicks();
  outfitPanel.hidden = true;
  matchEmpty.hidden = false;
});

// The closet can change while you're on the other tab, so check it each
// time the Match screen is shown.
function updateMatchNotice() {
  matchNeedsCloset.hidden = closet.length > 0;
}

document.getElementById("goToCloset").addEventListener("click", () => showScreen("closet"));

// ---------------------------------------------------------------
// Match screen: results
// ---------------------------------------------------------------
const GROUPS = [
  { stars: 3, label: "Great match" },
  { stars: 2, label: "Good match" },
  { stars: 1, label: "Could work" },
];
const STAR_PATH = "M12 3.5 14.4 9l5.6.5-4.3 3.7 1.3 5.6L12 15.9l-5 2.9 1.3-5.6L4 9.5 9.6 9z";
const SVG_NS = "http://www.w3.org/2000/svg";
let showRest = false;

function starIcons(count) {
  const wrap = document.createElement("span");
  wrap.className = "stars";
  wrap.setAttribute("role", "img");
  wrap.setAttribute("aria-label", `${count} out of 3 stars`);
  for (let i = 0; i < 3; i++) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", i < count ? "star is-on" : "star");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", STAR_PATH);
    svg.append(path);
    wrap.append(svg);
  }
  return wrap;
}

function resultCard({ hijab, reason }) {
  const card = document.createElement("li");
  card.className = "result-card";

  const img = document.createElement("img");
  img.src = hijab.thumb;
  img.alt = "";

  const text = document.createElement("div");
  text.className = "result-text";
  const name = document.createElement("span");
  name.className = "result-name";
  name.textContent = hijab.name || suggestName(hijab.lab);
  const why = document.createElement("span");
  why.className = "result-reason";
  why.textContent = reason;
  text.append(name, why);

  const swatch = document.createElement("span");
  swatch.className = "swatch";
  swatch.style.background = hijab.hex;

  card.append(img, text, swatch);
  return card;
}

function resultGroup(title, items, stars, extraClass) {
  const group = document.createElement("section");
  group.className = "result-group" + (extraClass ? ` ${extraClass}` : "");
  const head = document.createElement("h3");
  head.className = "result-group-head";
  if (stars) head.append(starIcons(stars));
  head.append(title);
  const list = document.createElement("ul");
  list.className = "result-list";
  list.append(...items.map(resultCard));
  group.append(head, list);
  return group;
}

function renderResults() {
  const picks = outfitPicker.picks;
  if (picks.length === 0) {
    results.hidden = true;
    return;
  }
  results.hidden = false;
  seeAll.hidden = true;
  resultGroups.replaceChildren();

  if (closet.length === 0) {
    resultsSub.textContent = "Your closet is empty. Add a few hijabs, then come back to this outfit.";
    return;
  }

  const ranked = rankCloset(closet, picks.map((p) => p.lab));
  if (ranked.length === 0) {
    resultsSub.textContent = "Every hijab in your closet is marked as in the wash.";
    return;
  }

  const starred = ranked.filter((r) => r.stars > 0);
  const rest = ranked.filter((r) => r.stars === 0);
  const n = starred.length;
  const total = ranked.length;
  if (n === 0) {
    resultsSub.textContent =
      "None of your hijabs are a strong match for these colours. A neutral like black, white or beige is the safe choice.";
  } else if (n === total) {
    resultsSub.textContent =
      total === 1 ? "Your hijab goes with this outfit." : `All ${total} of your hijabs go with this outfit.`;
  } else {
    resultsSub.textContent = `${n} of your ${total} hijabs ${n === 1 ? "goes" : "go"} with this outfit.`;
  }

  for (const { stars, label } of GROUPS) {
    const items = starred.filter((r) => r.stars === stars);
    if (items.length) resultGroups.append(resultGroup(label, items, stars));
  }

  if (rest.length) {
    seeAll.hidden = false;
    seeAll.textContent = showRest ? "Hide the rest" : `See all (${rest.length} more)`;
    if (showRest) resultGroups.append(resultGroup("Not a match for this outfit", rest, 0, "is-rest"));
  }
}

findMatches.addEventListener("click", () => {
  showRest = false;
  renderResults();
  results.scrollIntoView({ behavior: scrollBehavior, block: "start" });
});

seeAll.addEventListener("click", () => {
  showRest = !showRest;
  renderResults();
});
