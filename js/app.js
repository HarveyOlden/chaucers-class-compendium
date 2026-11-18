// Entry point: wires the editor, the preview, saving and printing together.
import { store, load, onChange, replaceClass, downloadJSON, readJSONFile, savePrefs } from "./state.js";
import { defaultClass } from "./data.js";
import { renderDocument } from "./render.js";
import { TABS, initEditor, setTab, renderPanel, showToast, resetEditorState } from "./editor.js";

load();

// ---------- tabs ----------
const tabsEl = document.getElementById("tabs");
tabsEl.innerHTML = TABS.map((t, i) => `<button type="button" role="tab" data-tab="${t.id}" aria-selected="${i === 0}">${t.label}</button>`).join("");
tabsEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (b) setTab(b.dataset.tab);
});
initEditor(document.getElementById("panel"), (id) => {
  tabsEl.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === id));
});

// ---------- preview ----------
const host = document.getElementById("doc-host");
let previewTimer;
function renderPreview() {
  host.innerHTML = renderDocument(store.cls);
  document.title = `${store.cls.name || "Untitled class"} · Chaucer's Class Compendium`;
}
onChange(() => { clearTimeout(previewTimer); previewTimer = setTimeout(renderPreview, 150); });
renderPreview();

// ---------- save status ----------
const status = document.getElementById("save-status");
const fmtTime = (d) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
document.addEventListener("cw:saved", () => { status.textContent = `Saved in this browser · ${fmtTime(store.savedAt)}`; status.classList.remove("error"); });
document.addEventListener("cw:save-failed", () => { status.textContent = "Couldn't autosave. Download a save to be safe."; status.classList.add("error"); });
if (localStorage.getItem("chaucer:v1:class")) status.textContent = "Restored from this browser";

// ---------- file actions ----------
document.getElementById("btn-download").onclick = () => { downloadJSON(); showToast("Save downloaded. Open it later with “Open save…”."); };

const fileInput = document.getElementById("file-input");
document.getElementById("btn-open").onclick = () => fileInput.click();
fileInput.onchange = async () => {
  const file = fileInput.files[0];
  fileInput.value = "";
  if (!file) return;
  try {
    const data = await readJSONFile(file);
    const previous = store.cls;
    resetEditorState();
    replaceClass(data);
    renderPanel();
    showToast(`Opened “${data.name || file.name}”.`, () => { replaceClass(previous); renderPanel(); });
  } catch (err) {
    showToast(err.message || "Couldn't open that file.");
  }
};

document.getElementById("btn-new").onclick = () => {
  if (!confirm("Start a new class? The current one will be replaced in this browser. You can undo straight afterwards, but download a save first if you want to keep it.")) return;
  const previous = store.cls;
  resetEditorState();
  replaceClass(defaultClass(previous.ruleset));
  setTab("overview");
  showToast("Started a new class.", () => { replaceClass(previous); renderPanel(); });
};

// ---------- settings & printing ----------
const dlg = document.getElementById("settings");
const prefPrinter = document.getElementById("pref-printer");
const prefPaper = document.getElementById("pref-paper");
document.getElementById("btn-settings").onclick = () => {
  prefPrinter.checked = store.prefs.printerFriendly;
  prefPaper.value = store.prefs.paper;
  const last = store.prefs.lastDownload;
  document.getElementById("last-download").textContent = last ? `Last downloaded save: ${new Date(last).toLocaleString()}` : "You haven't downloaded a save yet.";
  dlg.showModal();
};
prefPrinter.onchange = () => { store.prefs.printerFriendly = prefPrinter.checked; savePrefs(); applyPrintPrefs(); };
prefPaper.onchange = () => { store.prefs.paper = prefPaper.value; savePrefs(); applyPrintPrefs(); };

function applyPrintPrefs() {
  document.body.classList.toggle("print-parchment", !store.prefs.printerFriendly);
  document.body.classList.toggle("letter", store.prefs.paper === "letter");
  document.getElementById("page-style").textContent =
    `@page { size: ${store.prefs.paper === "letter" ? "letter" : "A4"}; margin: 15mm 13mm 16mm; }`;
}
applyPrintPrefs();

document.getElementById("btn-print").onclick = () => {
  renderPreview();
  window.print();
};

// ---------- mobile: switch between editor and preview ----------
const mobileToggle = document.getElementById("mobile-toggle");
mobileToggle.onclick = () => {
  const on = document.body.classList.toggle("show-preview");
  mobileToggle.textContent = on ? "Back to editor" : "Show preview";
};
