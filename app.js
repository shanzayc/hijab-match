// Screens, navigation, and photo capture.
// All image work happens on this device: photos are decoded in the
// browser and drawn onto a canvas, and nothing is uploaded.

// Photos are downscaled before any processing. 400 px on the long
// side keeps colour sampling fast even with large iPhone photos.
const MAX_SIDE = 400;

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
// Photo loading
// ---------------------------------------------------------------
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = url;
  });
}

// Decode a photo file and draw it onto the canvas, scaled so the
// long side is at most MAX_SIDE. Modern browsers apply the photo's
// EXIF rotation automatically, so portrait shots stay upright.
async function drawPhoto(file, canvas) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

let errorTimer;
function showError(message) {
  photoError.textContent = message;
  photoError.hidden = false;
  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => (photoError.hidden = true), 4000);
}

// Wire a camera input and a gallery input to the same canvas.
// onLoaded runs after the photo is drawn.
function wirePhotoInputs(inputs, canvas, onLoaded) {
  for (const input of inputs) {
    input.addEventListener("change", async () => {
      const file = input.files[0];
      // Reset so picking the same photo again still fires "change".
      input.value = "";
      if (!file) return;
      try {
        await drawPhoto(file, canvas);
        onLoaded();
      } catch {
        showError("That photo couldn't be opened. Try a JPEG or PNG.");
      }
    });
  }
}

// ---------------------------------------------------------------
// Closet screen
// ---------------------------------------------------------------
const closetEmpty = document.getElementById("closetEmpty");
const addPanel = document.getElementById("addPanel");
const hijabCanvas = document.getElementById("hijabCanvas");

wirePhotoInputs(
  [document.getElementById("hijabCamera"), document.getElementById("hijabGallery")],
  hijabCanvas,
  () => {
    closetEmpty.hidden = true;
    addPanel.hidden = false;
    addPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
);

document.getElementById("addCancel").addEventListener("click", () => {
  addPanel.hidden = true;
  closetEmpty.hidden = false;
});

// ---------------------------------------------------------------
// Match screen
// ---------------------------------------------------------------
const matchEmpty = document.getElementById("matchEmpty");
const outfitPanel = document.getElementById("outfitPanel");
const outfitCanvas = document.getElementById("outfitCanvas");

wirePhotoInputs(
  [document.getElementById("outfitCamera"), document.getElementById("outfitGallery")],
  outfitCanvas,
  () => {
    matchEmpty.hidden = true;
    outfitPanel.hidden = false;
    outfitPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
);

document.getElementById("outfitClear").addEventListener("click", () => {
  outfitPanel.hidden = true;
  matchEmpty.hidden = false;
});
