// The form side of the app: one panel per book tab.
import { store, changed, getPath, setPath } from "./state.js";
import { esc } from "./render.js";
import { SPELLS, SPELL_CLASSES, SCHOOLS } from "./spells.js";
import {
  ABILITIES, SKILLS, HIT_DICE, LEVELS, SLOT_PRESETS, COUNT_PRESETS, COUNT_MODES, RULESETS, IMAGES,
  newFeature, newSubclass, newCustomSpell, uid, ordinal,
} from "./data.js";

export const TABS = [
  { id: "overview", label: "Overview", title: "Overview & Flavour" },
  { id: "core", label: "Core Traits", title: "Core Traits" },
  { id: "features", label: "Features", title: "Class Features" },
  { id: "progression", label: "Progression", title: "Level Progression" },
  { id: "spellcasting", label: "Spellcasting", title: "Spellcasting" },
  { id: "subclasses", label: "Subclasses", title: "Subclasses" },
];

let activeSubclass = 0;
let spellSearch = "";
const openSpellLevels = new Set();
let lastUndo = null;

// ---------- small HTML builders ----------
const attrs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== false).map(([k, v]) => (v === true ? k : `${k}="${esc(v)}"`)).join(" ");

function field(label, path, { type = "text", placeholder = "", hint = "", cls = "", num = false, min, max } = {}) {
  const v = getPath(store.cls, path);
  return `<label class="field ${cls}"><span>${label}</span>
    <input ${attrs({ type, "data-path": path, value: v ?? "", placeholder, "data-num": num || type === "number", min, max })}>
    ${hint ? `<small>${hint}</small>` : ""}</label>`;
}

function select(label, path, options, { num = false, structural = false, cls = "" } = {}) {
  const v = String(getPath(store.cls, path));
  return `<label class="field ${cls}"><span>${label}</span>
    <select ${attrs({ "data-path": path, "data-num": num, "data-structural": structural })}>
      ${options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === v ? "selected" : ""}>${esc(o.label)}</option>`).join("")}
    </select></label>`;
}

function check(label, path, { structural = false } = {}) {
  return `<label class="check"><input type="checkbox" ${attrs({ "data-path": path, "data-structural": structural, checked: !!getPath(store.cls, path) })}> ${label}</label>`;
}

function multi(label, path, items, { num = false, hint = "" } = {}) {
  const cur = getPath(store.cls, path).map(String);
  return `<fieldset class="multi"><legend>${label}</legend>
    ${items.map((it) => `<label class="check"><input type="checkbox" ${attrs({ "data-multi": it.value ?? it, "data-path": path, "data-num": num, checked: cur.includes(String(it.value ?? it)) })}> ${esc(it.label ?? it)}</label>`).join("")}
    ${hint ? `<small>${hint}</small>` : ""}</fieldset>`;
}

const TOOLBAR = `<div class="md-toolbar" role="toolbar" aria-label="Formatting">
  <button type="button" data-fmt="bold" title="Bold"><b>B</b></button>
  <button type="button" data-fmt="italic" title="Italic"><i>I</i></button>
  <button type="button" data-fmt="h" title="Sub-heading">H</button>
  <button type="button" data-fmt="list" title="Bulleted list">•</button>
  <button type="button" data-fmt="quote" title="Sidebar box">❝</button>
  <button type="button" data-fmt="table" title="Table">▦</button>
</div>`;

function mdField(label, path, { rows = 6, placeholder = "" } = {}) {
  return `<div class="field md-field"><span>${label}</span>${TOOLBAR}
    <textarea ${attrs({ "data-path": path, rows, placeholder })}>${esc(getPath(store.cls, path))}</textarea>
    </div>`;
}

function levelRow(label, path, { hint = "" } = {}) {
  const vals = getPath(store.cls, path);
  return `<div class="level-row"><div class="level-row-head"><span>${label}</span>
      <button type="button" class="link" data-action="fill-forward" data-path="${path}" title="Copy each value into the empty boxes after it">Fill blanks forward</button></div>
    <div class="level-grid">${LEVELS.map((l) => `<label><small>${l}</small><input ${attrs({ "data-path": `${path}.${l - 1}`, value: vals[l - 1] ?? "" })}></label>`).join("")}</div>
    ${hint ? `<small>${hint}</small>` : ""}</div>`;
}

const btn = (label, action, data = {}, cls = "") => `<button type="button" class="${cls}" ${attrs({ "data-action": action, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [`data-${k}`, v])) })}>${label}</button>`;

const spotSelect = (path) => select("Illustration", path,
  [{ value: "", label: "None" }, ...Object.entries(IMAGES.spots).map(([value, label]) => ({ value, label }))], { cls: "spot-select" });

const emptyState = (image) => `<div class="empty-state"><img src="img/${image}.png" alt=""></div>`;

const SPELL_LEVELS = Array.from({ length: 10 }, (_, l) => ({ value: l, label: l === 0 ? "Cantrip" : `Level ${l}` }));

function spellPicker(sc) {
  const all = SPELLS[store.cls.ruleset];
  const picked = new Set(sc.picked.map((p) => p.name));
  const q = spellSearch.trim().toLowerCase();
  const levels = Array.from({ length: 10 }, (_, l) => all.filter((s) => s[1] === l));
  return `<div class="row">
      <label class="field grow"><span>Tick a class's spells</span><select id="spell-class">
        <option value="">—</option>
        ${SPELL_CLASSES.map((c, i) => `<option value="${i}">${c}</option>`).join("")}</select></label>
      ${btn("Untick all", "clear-spells", {}, "danger")}
    </div>
    <div class="row">
      <label class="field grow"><span>Search</span><input type="search" id="spell-search" value="${esc(spellSearch)}"></label>
      <span class="spell-total">${picked.size} selected</span>
    </div>
    <div class="spell-picker">
      ${levels.map((list, l) => list.length ? `<details data-level="${l}" ${openSpellLevels.has(l) || q ? "open" : ""}>
        <summary>${l === 0 ? "Cantrips" : `Level ${l}`} <span class="lvl-count">${list.filter((s) => picked.has(s[0])).length} ticked</span></summary>
        <div class="spell-grid">${list.map((s) => `<label class="check" title="${esc(SCHOOLS[s[2]])} · ${esc(s[3].map((c) => SPELL_CLASSES[c]).join(", "))}" ${q && !s[0].toLowerCase().includes(q) ? "hidden" : ""}>
          <input type="checkbox" data-spell="${esc(s[0])}" data-spell-level="${l}" ${picked.has(s[0]) ? "checked" : ""}> ${esc(s[0])}</label>`).join("")}</div>
      </details>` : "").join("")}
    </div>`;
}

function customSpellEditor(sp, i) {
  const p = `spellcasting.customSpells.${i}`;
  return `<div class="card">
    <div class="row">
      ${field("Name", `${p}.name`, { cls: "grow" })}
      ${select("Level", `${p}.level`, SPELL_LEVELS, { num: true, cls: "narrow" })}
      ${select("School", `${p}.school`, SCHOOLS.map((s) => ({ value: s, label: s })), { cls: "narrow" })}
    </div>
    <div class="row">
      ${field("Casting time", `${p}.castingTime`, { cls: "grow" })}
      ${field("Range", `${p}.range`, { cls: "grow" })}
    </div>
    <div class="row">
      ${field("Components", `${p}.components`, { cls: "grow" })}
      ${field("Duration", `${p}.duration`, { cls: "grow" })}
      ${check("Ritual", `${p}.ritual`)}
    </div>
    ${mdField("Description", `${p}.body`, { rows: 5 })}
    <div class="card-actions">${btn("Delete spell", "delete", { list: "spellcasting.customSpells", index: i, what: "spell" }, "danger small")}</div>
  </div>`;
}

const levelOptions = (levels = LEVELS) => levels.map((l) => ({ value: l, label: `Level ${l}` }));

// ---------- feature editor (shared by class and subclass features) ----------
function featureEditor(f, path, listPath, index, levels) {
  const optList = f.kind === "choice" ? `<div class="options-editor">
      <div class="row">${field("Number to choose", `${path}.choose`, { type: "number", min: 1, cls: "narrow" })}</div>
      ${f.options.map((o, i) => `<div class="option-card">
          <div class="row">${field(`Option ${i + 1} name`, `${path}.options.${i}.name`)}
            ${btn("Remove", "delete", { list: `${path}.options`, index: i, what: "option" }, "danger small")}</div>
          ${mdField("Option text", `${path}.options.${i}.body`, { rows: 3 })}
        </div>`).join("")}
      ${btn("+ Add option", "add-option", { path: `${path}.options` }, "small")}
    </div>` : "";
  return `<div class="card feature-card" data-id="${esc(f.id)}">
    <div class="row">
      ${select("Level", `${path}.level`, levelOptions(levels), { num: true, structural: true, cls: "narrow" })}
      ${field("Feature name", `${path}.name`, { cls: "grow" })}
      ${select("Type", `${path}.kind`, [{ value: "standard", label: "Standard" }, { value: "choice", label: "Choice of options" }], { structural: true, cls: "narrow" })}
    </div>
    ${mdField(f.kind === "choice" ? "Introduction (optional)" : "Description", `${path}.body`, { rows: f.kind === "choice" ? 3 : 5 })}
    ${optList}
    <div class="card-actions">
      ${btn("↑", "move-feature", { list: listPath, index, dir: -1 }, "small")}
      ${btn("↓", "move-feature", { list: listPath, index, dir: 1 }, "small")}
      ${btn("Delete feature", "delete", { list: listPath, index, what: "feature" }, "danger small")}
    </div>
  </div>`;
}

function sortedIndexes(list) {
  return list.map((f, i) => i).sort((a, b) => list[a].level - list[b].level || a - b);
}

// ---------- panels ----------
const panels = {
  overview() {
    const c = store.cls;
    return `
      <div class="row">
        ${field("Class name", "name", { placeholder: "e.g. Hexblade Knight", cls: "grow" })}
        ${select("Ruleset", "ruleset", Object.entries(RULESETS).map(([value, r]) => ({ value, label: r.label })), { structural: true, cls: "narrow" })}
      </div>
      ${field("Tagline (shown on the cover)", "tagline", {})}
      ${field("Author", "author")}
      <div class="row">
        ${select("Class page header", "header", Object.entries(IMAGES.headers).map(([value, label]) => ({ value, label })), { cls: "grow" })}
        ${check("Include a cover page", "cover")}
      </div>
      <fieldset class="group"><legend>Epigraph (optional)</legend>
        ${field("Quote", "epigraph.quote")}
        ${field("Attributed to", "epigraph.attribution")}
      </fieldset>
      ${mdField("Introduction", "flavour", { rows: 8 })}
      ${spotSelect("illustration")}
      <h3 class="sub">Sub-sections</h3>
      ${c.sections.map((s, i) => `<div class="card">
          <div class="row">${field("Section title", `sections.${i}.title`, { cls: "grow" })}
            ${btn("↑", "move", { list: "sections", index: i, dir: -1 }, "small")}
            ${btn("↓", "move", { list: "sections", index: i, dir: 1 }, "small")}
            ${btn("Delete", "delete", { list: "sections", index: i, what: "section" }, "danger small")}</div>
          ${mdField("Text", `sections.${i}.body`, { rows: 5 })}
          ${spotSelect(`sections.${i}.illustration`)}
        </div>`).join("")}
      ${btn("+ Add sub-section", "add-section")}`;
  },

  core() {
    return `
      ${store.cls.ruleset === "2024" ? field("Primary ability", "core.primaryAbility", { placeholder: "e.g. Strength or Dexterity" }) : ""}
      <div class="row">
        ${select("Hit die", "core.hitDie", HIT_DICE.map((d) => ({ value: d, label: `d${d}` })), { num: true, cls: "narrow" })}
      </div>
      ${multi("Saving throw proficiencies", "core.saves", ABILITIES)}
      <div class="row">${field("Number of skills to choose", "core.skillCount", { type: "number", min: 0, max: 18, cls: "narrow" })}</div>
      ${multi("Skills to choose from (none ticked = any)", "core.skills", SKILLS)}
      ${field("Weapon proficiencies", "core.weapons", { placeholder: "e.g. Simple and Martial weapons" })}
      ${field("Armor training", "core.armor", { placeholder: "e.g. Light and Medium armor and Shields" })}
      ${field("Tool proficiencies (optional)", "core.tools", { placeholder: "e.g. Thieves' Tools" })}
      ${store.cls.ruleset === "2024" ? `<fieldset class="group"><legend>Starting equipment</legend>
        ${field("Option A", "core.equipmentA", { placeholder: "e.g. Chain Mail, Longsword, Explorer's Pack, and 8 GP" })}
        ${field("Option B (optional)", "core.equipmentB")}
        ${field("Or gold instead (GP, 0 for none)", "core.equipmentGold", { type: "number", min: 0, cls: "narrow" })}
      </fieldset>` : `<fieldset class="group"><legend>Starting equipment</legend>
        <label class="field"><span>One item or choice per line</span>
          <textarea rows="5" data-path="core.equipmentList" placeholder="(a) a greataxe or (b) any martial melee weapon&#10;(a) two handaxes or (b) any simple weapon&#10;An explorer's pack and four javelins">${esc(store.cls.core.equipmentList)}</textarea></label>
        ${field("Alternative starting wealth (optional)", "core.equipmentWealth", { placeholder: "e.g. 2d4 × 10 gp" })}
      </fieldset>`}`;
  },

  features() {
    const list = store.cls.features;
    return `${list.length ? "" : emptyState("turnip")}
      ${sortedIndexes(list).map((i) => featureEditor(list[i], `features.${i}`, "features", i, LEVELS)).join("")}
      ${btn("+ Add feature", "add-feature", { list: "features" })}`;
  },

  progression() {
    const c = store.cls;
    return `
      <div class="row">${field("What subclasses are called", "subclassTerm", { placeholder: "Subclass, Oath, Circle, Tradition…", cls: "grow" })}</div>
      ${multi("Levels that grant subclass features", "subclassLevels", LEVELS.map((l) => ({ value: l, label: l })), { num: true })}
      <h3 class="sub">Extra table columns</h3>
      ${c.columns.map((col, i) => `<div class="card">
          <div class="row">${field("Column name", `columns.${i}.name`, { cls: "grow" })}
            ${btn("↑", "move", { list: "columns", index: i, dir: -1 }, "small")}
            ${btn("↓", "move", { list: "columns", index: i, dir: 1 }, "small")}
            ${btn("Delete", "delete", { list: "columns", index: i, what: "column" }, "danger small")}</div>
          ${levelRow("Value at each level", `columns.${i}.values`)}
        </div>`).join("")}
      ${btn("+ Add column", "add-column")}`;
  },

  spellcasting() {
    const sc = store.cls.spellcasting;
    if (!sc.enabled) return `${check("This class casts spells", "spellcasting.enabled", { structural: true })}`;
    const slotEditor = sc.progression === "custom"
      ? `<div class="slot-grid"><table><thead><tr><th>Lvl</th>${Array.from({ length: 9 }, (_, i) => `<th>${ordinal(i + 1)}</th>`).join("")}</tr></thead><tbody>
          ${LEVELS.map((l) => `<tr><th>${l}</th>${Array.from({ length: 9 }, (_, s) => `<td><input ${attrs({ "data-path": `spellcasting.customSlots.${l - 1}.${s}`, value: sc.customSlots[l - 1][s] || "", "data-num": true, inputmode: "numeric" })}></td>`).join("")}</tr>`).join("")}
        </tbody></table></div>`
      : "";
    return `
      ${check("This class casts spells", "spellcasting.enabled", { structural: true })}
      <div class="row">
        ${field("Feature name", "spellcasting.name", { cls: "grow" })}
        ${select("Gained at", "spellcasting.level", levelOptions(), { num: true, cls: "narrow" })}
      </div>
      ${select("Spellcasting ability", "spellcasting.ability", ABILITIES.map((a) => ({ value: a, label: a })))}
      ${select("Spell slot progression", "spellcasting.progression", Object.entries(SLOT_PRESETS).map(([value, p]) => ({ value, label: p.label })), { structural: true })}
      ${slotEditor}
      <h3 class="sub">Cantrips & spells</h3>
      <div class="row">
        <label class="field grow"><span>Copy counts from</span><select id="count-preset">
          ${Object.entries(COUNT_PRESETS[store.cls.ruleset]).map(([k, p]) => `<option value="${k}">${esc(p.label)}</option>`).join("")}</select></label>
        ${btn("Apply", "apply-counts")}
      </div>
      <div class="row">
        ${select("How spells are counted", "spellcasting.countMode", Object.entries(COUNT_MODES).map(([value, m]) => ({ value, label: m.label })), { structural: true, cls: "grow" })}
        ${check("Show Cantrips column", "spellcasting.showCantrips")}
      </div>
      ${levelRow("Cantrips known", "spellcasting.cantrips")}
      ${sc.countMode !== "none" ? levelRow(COUNT_MODES[sc.countMode].column, "spellcasting.counts") : ""}
      ${mdField("Spellcasting description", "spellcasting.description", { rows: 10 })}
      <h3 class="sub">Spell list</h3>
      ${spellPicker(sc)}
      <details class="manual-spells"><summary>Type other spells</summary>
        ${sc.spellList.map((_, lvl) => `<label class="field"><span>${lvl === 0 ? "Cantrips" : `Level ${lvl} spells`} (one per line)</span>
          <textarea rows="2" data-path="spellcasting.spellList.${lvl}">${esc(sc.spellList[lvl])}</textarea></label>`).join("")}
      </details>
      <h3 class="sub">Custom spells</h3>
      ${sc.customSpells.map((sp, i) => customSpellEditor(sp, i)).join("")}
      ${btn("+ Add custom spell", "add-custom-spell")}`;
  },

  subclasses() {
    const c = store.cls;
    if (activeSubclass >= c.subclasses.length) activeSubclass = Math.max(0, c.subclasses.length - 1);
    const pills = `<div class="pills">${c.subclasses.map((s, i) => `<button type="button" class="pill ${i === activeSubclass ? "active" : ""}" data-action="pick-subclass" data-index="${i}">${esc(s.name || "Untitled")}</button>`).join("")}
      ${btn(`+ Add ${esc(c.subclassTerm.toLowerCase() || "subclass")}`, "add-subclass", {}, "pill add")}</div>`;
    if (!c.subclasses.length) return `${pills}${emptyState("creatures")}`;
    const s = c.subclasses[activeSubclass];
    const base = `subclasses.${activeSubclass}`;
    const levels = c.subclassLevels.length ? c.subclassLevels : LEVELS;
    return `${pills}
      <div class="row">${field("Name", `${base}.name`, { cls: "grow" })}
        ${select("Header", `${base}.header`, Object.entries(IMAGES.headers).map(([value, label]) => ({ value, label })), { cls: "narrow" })}</div>
      ${mdField("Introduction", `${base}.flavour`, { rows: 6 })}
      ${spotSelect(`${base}.illustration`)}
      <h3 class="sub">Features</h3>
      ${sortedIndexes(s.features).map((i) => featureEditor(s.features[i], `${base}.features.${i}`, `${base}.features`, i, levels)).join("")}
      ${btn("+ Add feature", "add-feature", { list: `${base}.features` })}
      <div class="card-actions end">${btn(`Delete this ${esc(c.subclassTerm.toLowerCase())}`, "delete", { list: "subclasses", index: activeSubclass, what: c.subclassTerm.toLowerCase() }, "danger")}</div>`;
  },
};

// ---------- rendering & events ----------
let currentTab = "overview";
let panelEl, onTabChange;

export function renderPanel() {
  const tab = TABS.find((t) => t.id === currentTab);
  const scroll = panelEl.scrollTop;
  panelEl.innerHTML = `<header class="panel-head">
      <img src="img/${IMAGES.tabs[tab.id]}.png" alt="">
      <h2>${tab.title}</h2>
    </header>
    <div class="panel-body">${panels[tab.id]()}</div>`;
  panelEl.scrollTop = scroll;
}

export function setTab(id) {
  currentTab = id;
  renderPanel();
  panelEl.scrollTop = 0;
  onTabChange?.(id);
}

function readValue(el) {
  if (el.type === "checkbox") return el.checked;
  if (el.dataset.num !== undefined && el.dataset.num !== "false") return el.value === "" ? 0 : Number(el.value);
  return el.value;
}

function handleInput(e) {
  const el = e.target;
  const path = el.dataset.path;
  if (!path) return;
  if (el.dataset.multi !== undefined) {
    const boxes = [...panelEl.querySelectorAll(`input[data-multi][data-path="${path}"]`)];
    const num = el.dataset.num !== undefined && el.dataset.num !== "false";
    setPath(store.cls, path, boxes.filter((b) => b.checked).map((b) => (num ? Number(b.dataset.multi) : b.dataset.multi)));
  } else {
    setPath(store.cls, path, readValue(el));
  }
  const structural = el.dataset.structural !== undefined && el.dataset.structural !== "false";
  if (path === "ruleset") {
    showToast(el.value === "2014"
      ? "Switched to 2014 layout. Existing features aren't changed, so check level 19 (Ability Score Improvement in 2014)."
      : "Switched to 2024 layout. Existing features aren't changed, so check level 19 (Epic Boon in 2024).");
  }
  if (structural && e.type === "change") renderPanel();
  changed({ structural });
}

function wrapSelection(ta, before, after = "", placeholder = "text") {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const sel = value.slice(s, e) || placeholder;
  ta.setRangeText(before + sel + after, s, e, "end");
  ta.focus();
  ta.dispatchEvent(new Event("input", { bubbles: true }));
}

function prefixLines(ta, prefix) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const lineStart = value.lastIndexOf("\n", s - 1) + 1;
  const block = value.slice(lineStart, e) || "text";
  ta.setRangeText(block.split("\n").map((l) => prefix + l).join("\n"), lineStart, e, "end");
  ta.focus();
  ta.dispatchEvent(new Event("input", { bubbles: true }));
}

function format(kind, ta) {
  switch (kind) {
    case "bold": return wrapSelection(ta, "**", "**");
    case "italic": return wrapSelection(ta, "*", "*");
    case "h": return prefixLines(ta, "### ");
    case "list": return prefixLines(ta, "- ");
    case "quote": return prefixLines(ta, "> ");
    case "table": return wrapSelection(ta, "\n| Heading | Heading |\n|---|---|\n| ", " | Cell |\n", "Cell");
  }
}

export function showToast(msg, undo) {
  const t = document.getElementById("toast");
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button" id="toast-undo">Undo</button>' : ""}`;
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.hidden = true; }, 7000);
  if (undo) document.getElementById("toast-undo").onclick = () => { undo(); t.hidden = true; };
}

const actions = {
  "add-section": () => store.cls.sections.push({ title: "New Section", body: "" }),
  "add-column": () => store.cls.columns.push({ name: "New Column", values: LEVELS.map(() => "") }),
  "add-feature": ({ list }) => {
    const arr = getPath(store.cls, list);
    const isSub = list.startsWith("subclasses");
    const lvl = isSub ? store.cls.subclassLevels[0] || 3 : 1;
    arr.push(newFeature(lvl));
  },
  "add-option": ({ path }) => getPath(store.cls, path).push({ name: "", body: "" }),
  "add-subclass": () => { store.cls.subclasses.push(newSubclass()); activeSubclass = store.cls.subclasses.length - 1; },
  "pick-subclass": ({ index }) => { activeSubclass = Number(index); },
  move: ({ list, index, dir }) => {
    const arr = getPath(store.cls, list), i = Number(index), j = i + Number(dir);
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  },
  "move-feature": ({ list, index, dir }) => {
    // Swap with the neighbouring feature at the same level, in display order.
    const arr = getPath(store.cls, list), order = sortedIndexes(arr), pos = order.indexOf(Number(index));
    const other = order[pos + Number(dir)];
    if (other === undefined || arr[other].level !== arr[index].level) return;
    [arr[index], arr[other]] = [arr[other], arr[index]];
  },
  delete: ({ list, index, what }) => {
    const arr = getPath(store.cls, list), i = Number(index);
    const [item] = arr.splice(i, 1);
    lastUndo = () => { getPath(store.cls, list).splice(i, 0, item); changed({ structural: true }); renderPanel(); };
    showToast(`Deleted ${what}${item.name ? ` “${item.name}”` : item.title ? ` “${item.title}”` : ""}.`, lastUndo);
  },
  "fill-forward": ({ path }) => {
    const arr = getPath(store.cls, path);
    let last = "";
    for (let i = 0; i < arr.length; i++) { if (String(arr[i] ?? "").trim() === "") arr[i] = last; else last = arr[i]; }
  },
  "add-custom-spell": () => store.cls.spellcasting.customSpells.push(newCustomSpell()),

  "clear-spells": () => {
    const sc = store.cls.spellcasting, previous = sc.picked;
    sc.picked = [];
    showToast("Spell list cleared.", () => { sc.picked = previous; changed({ structural: true }); renderPanel(); });
  },
  "apply-counts": () => {
    const sc = store.cls.spellcasting;
    const p = COUNT_PRESETS[store.cls.ruleset][document.getElementById("count-preset").value];
    sc.cantrips = p.cantrips.slice();
    sc.counts = p.counts.slice();
    sc.countMode = p.mode;
    sc.showCantrips = p.cantrips.some((n) => n > 0);
  },
};

function updateSpellCounts() {
  const picked = new Set(store.cls.spellcasting.picked.map((p) => p.name));
  panelEl.querySelector(".spell-total").textContent = `${picked.size} selected`;
  panelEl.querySelectorAll(".spell-picker details").forEach((d) => {
    const boxes = [...d.querySelectorAll("[data-spell]")];
    d.querySelector(".lvl-count").textContent = `${boxes.filter((b) => b.checked).length} ticked`;
  });
}

function toggleSpell(box) {
  const sc = store.cls.spellcasting, name = box.dataset.spell;
  sc.picked = sc.picked.filter((p) => p.name !== name);
  if (box.checked) sc.picked.push({ name, level: Number(box.dataset.spellLevel) });
  updateSpellCounts();
  changed();
}

// Picking a class replaces the ticks with that class's spells; adjust freely afterwards.
function tickClassSpells(value) {
  if (value === "") return;
  const sc = store.cls.spellcasting, previous = sc.picked, cls = Number(value);
  sc.picked = SPELLS[store.cls.ruleset].filter((s) => s[3].includes(cls)).map((s) => ({ name: s[0], level: s[1] }));
  renderPanel();
  changed({ structural: true });
  showToast(`Ticked ${sc.picked.length} ${SPELL_CLASSES[cls]} spells.`, () => { sc.picked = previous; changed({ structural: true }); renderPanel(); });
}

function filterSpells(value) {
  spellSearch = value;
  const q = value.trim().toLowerCase();
  panelEl.querySelectorAll(".spell-picker details").forEach((d) => {
    let any = false;
    d.querySelectorAll(".spell-grid label").forEach((l) => {
      const show = !q || l.textContent.toLowerCase().includes(q);
      l.hidden = !show;
      any ||= show;
    });
    d.hidden = !any;
    if (q) d.open = true;
  });
}

export function initEditor(el, tabChange) {
  panelEl = el;
  onTabChange = tabChange;
  el.addEventListener("input", (e) => {
    if (e.target.id === "spell-search") return filterSpells(e.target.value);
    if (e.target.type !== "checkbox" && e.target.tagName !== "SELECT") handleInput(e);
  });
  el.addEventListener("change", (e) => {
    if (e.target.dataset.spell !== undefined) return toggleSpell(e.target);
    if (e.target.id === "spell-class") return tickClassSpells(e.target.value);
    if (e.target.type === "checkbox" || e.target.tagName === "SELECT") handleInput(e);
  });
  el.addEventListener("toggle", (e) => {
    const lvl = e.target.dataset?.level;
    if (lvl === undefined) return;
    e.target.open ? openSpellLevels.add(Number(lvl)) : openSpellLevels.delete(Number(lvl));
  }, true);
  el.addEventListener("click", (e) => {
    const fmt = e.target.closest("[data-fmt]");
    if (fmt) return format(fmt.dataset.fmt, fmt.closest(".md-field").querySelector("textarea"));
    const b = e.target.closest("[data-action]");
    if (!b || !actions[b.dataset.action]) return;
    if (actions[b.dataset.action]({ ...b.dataset }) === false) return;
    renderPanel();
    changed({ structural: true });
  });
  renderPanel();
}

export function resetEditorState() { activeSubclass = 0; }
export { uid };
