// Screens, navigation, and the closet.
// All image work happens on this device: photos are decoded in the
// browser and drawn onto a canvas, and nothing is uploaded.

import { PhotoPicker } from "./picker.js";
import { loadCloset, saveCloset, newId } from "./storage.js";

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
    pickHint.textContent = "Not quite right? Tap or drag again.";
  },
});

wirePhotoInputs(
  [document.getElementById("hijabCamera"), document.getElementById("hijabGallery")],
  hijabPicker,
  () => {
    hijabName.value = "";
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
// Match screen
// ---------------------------------------------------------------
const matchEmpty = document.getElementById("matchEmpty");
const outfitPanel = document.getElementById("outfitPanel");

// Picking outfit pieces arrives on Day 3; for now the photo just shows.
const outfitPicker = new PhotoPicker(document.getElementById("outfitCanvas"), { maxPicks: 0 });

wirePhotoInputs(
  [document.getElementById("outfitCamera"), document.getElementById("outfitGallery")],
  outfitPicker,
  () => {
    matchEmpty.hidden = true;
    outfitPanel.hidden = false;
    outfitPanel.scrollIntoView({ behavior: scrollBehavior, block: "start" });
  }
);

document.getElementById("outfitClear").addEventListener("click", () => {
  outfitPanel.hidden = true;
  matchEmpty.hidden = false;
});
