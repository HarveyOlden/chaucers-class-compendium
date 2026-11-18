// App state: the class being edited, autosave to localStorage, JSON import/export.
import { defaultClass, SCHEMA_VERSION } from "./data.js";

const KEY = "chaucer:v1:class";
const PREFS_KEY = "chaucer:v1:prefs";

export const store = {
  cls: null,
  prefs: { printerFriendly: true, paper: "A4", lastDownload: null },
  listeners: new Set(),
  savedAt: null,
};

export function onChange(fn) { store.listeners.add(fn); }

let saveTimer = null;
export function changed({ structural = false } = {}) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
  store.listeners.forEach((fn) => fn({ structural }));
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store.cls));
    localStorage.setItem(PREFS_KEY, JSON.stringify(store.prefs));
    store.savedAt = new Date();
    document.dispatchEvent(new CustomEvent("cw:saved"));
  } catch (e) {
    document.dispatchEvent(new CustomEvent("cw:save-failed", { detail: e }));
  }
}

export function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(store.prefs)); } catch {}
}

// Fill in any fields missing from older or hand-edited files, using the defaults.
function mergeDefaults(target, defaults) {
  for (const [k, v] of Object.entries(defaults)) {
    if (!(k in target) || target[k] === null || target[k] === undefined) target[k] = structuredClone(v);
    else if (v && typeof v === "object" && !Array.isArray(v) && typeof target[k] === "object") mergeDefaults(target[k], v);
  }
  return target;
}

export function migrate(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("This file doesn't look like a Chaucer's Class Compendium save.");
  if (typeof data.schema !== "number") throw new Error("This file is missing a version number, so it may not be a Chaucer's Class Compendium save.");
  if (data.schema > SCHEMA_VERSION) throw new Error("This file was made by a newer version of the site. Refresh the page and try again.");
  // Future schema upgrades go here: if (data.schema === 1) { ...; data.schema = 2; }
  const merged = mergeDefaults(data, defaultClass(data.ruleset === "2024" ? "2024" : "2014"));
  for (const sec of merged.sections) mergeDefaults(sec, { title: "", body: "", illustration: "" });
  for (const sp of merged.spellcasting.customSpells) mergeDefaults(sp, { name: "", level: 1, school: "Evocation", ritual: false, castingTime: "", range: "", components: "", duration: "", body: "" });
  for (const f of merged.features) mergeDefaults(f, { kind: "standard", body: "", choose: 1, options: [], level: 1, name: "" });
  for (const s of merged.subclasses) {
    mergeDefaults(s, { name: "", header: "devil_header", illustration: "", flavour: "", features: [] });
    for (const f of s.features) mergeDefaults(f, { kind: "standard", body: "", choose: 1, options: [], level: 3, name: "" });
  }
  return merged;
}

export function load() {
  try { Object.assign(store.prefs, JSON.parse(localStorage.getItem(PREFS_KEY) || "{}")); } catch {}
  try {
    const raw = localStorage.getItem(KEY);
    store.cls = raw ? migrate(JSON.parse(raw)) : defaultClass();
  } catch {
    store.cls = defaultClass();
  }
  // Ask the browser not to evict our storage (helps with Safari's 7-day rule where supported).
  navigator.storage?.persist?.().catch(() => {});
}

export function replaceClass(data) {
  store.cls = data;
  changed({ structural: true });
}

export function downloadJSON() {
  const name = (store.cls.name || "untitled-class").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const blob = new Blob([JSON.stringify(store.cls, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name || "class"}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  store.prefs.lastDownload = new Date().toISOString();
  savePrefs();
}

export async function readJSONFile(file) {
  const text = await file.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("That file isn't valid JSON."); }
  return migrate(data);
}

// Paths like "features.3.options.1.body"
export function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}
export function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const parent = keys.reduce((o, k) => o[k], obj);
  parent[last] = value;
}
