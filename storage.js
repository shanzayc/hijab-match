// Closet storage. The whole closet is one JSON array in localStorage:
// [{ id, name, hex, lab, thumb, inWash, createdAt }, ...]
// At about 15 KB per thumbnail, 50 hijabs fits well under the
// browser's 5 MB limit.

const KEY = "closet";

export function loadCloset() {
  try {
    const items = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

// Returns true on success. Fails when storage is full or blocked
// (for example in some private browsing modes).
export function saveCloset(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
