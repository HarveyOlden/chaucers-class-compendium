// Turns the class data into the book-style document used for the preview and the PDF.
import { marked } from "../vendor/marked.esm.js";
import DOMPurify from "../vendor/purify.es.mjs";
import { LEVELS, profBonus, SLOT_PRESETS, PACT, COUNT_MODES, ordinal } from "./data.js";

marked.setOptions({ gfm: true, breaks: false });

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const md = (s) => DOMPurify.sanitize(marked.parse(String(s ?? "")));

const listJoin = (items, last = "and") =>
  items.length <= 1 ? items.join("") : items.length === 2 ? `${items[0]} ${last} ${items[1]}` : `${items.slice(0, -1).join(", ")}, ${last} ${items.at(-1)}`;

const spot = (name) => (name ? `<img class="spot" src="img/${esc(name)}.png" alt="">` : "");
const img = (name, cls = "", alt = "") => `<img class="${cls}" src="img/${esc(name)}.png" alt="${esc(alt)}">`;

export function slotsFor(sc, level, ruleset) {
  if (sc.progression === "custom") return sc.customSlots[level - 1].map((n) => Number(n) || 0);
  const p = SLOT_PRESETS[sc.progression];
  return p?.slots ? p.slots(level, ruleset) : Array(9).fill(0);
}

const is2014 = (cls) => cls.ruleset === "2014";
function featureHeading(cls, level, name) {
  return is2014(cls)
    ? `<h4>${esc(name || "Untitled")} <span class="lvl">${ordinal(level)} level</span></h4>`
    : `<h4>Level ${level}: ${esc(name || "Untitled")}</h4>`;
}

// Features shown in the class table and in the class features section, including the
// spellcasting feature and automatic "Subclass Feature" entries.
export function classFeatureEntries(cls) {
  const term = cls.subclassTerm || "Subclass";
  const entries = cls.features.map((f) => ({ ...f, source: "user" }));
  if (cls.spellcasting.enabled) {
    entries.push({ id: "spellcasting", level: Number(cls.spellcasting.level) || 1, name: cls.spellcasting.name || "Spellcasting", source: "spellcasting", order: -1 });
  }
  const isSubclassName = (n) => /subclass/i.test(n) || (term && n.toLowerCase().includes(term.toLowerCase()));
  for (const lvl of cls.subclassLevels) {
    if (!entries.some((e) => e.level === lvl && isSubclassName(e.name))) {
      entries.push({ id: `auto-sub-${lvl}`, level: lvl, name: is2014(cls) ? `${term} feature` : `${term} Feature`, source: "auto",
        body: `You gain a feature from your ${term.toLowerCase()}.` });
    }
  }
  return entries
    .map((e, i) => ({ ...e, _i: e.order ?? i }))
    .sort((a, b) => a.level - b.level || a._i - b._i);
}

export function classTable(cls) {
  const sc = cls.spellcasting;
  const entries = classFeatureEntries(cls);
  const pact = sc.enabled && sc.progression === "pact";
  let maxSlot = 0;
  if (sc.enabled && !pact) {
    for (const l of LEVELS) slotsFor(sc, l, cls.ruleset).forEach((n, i) => { if (n > 0) maxSlot = Math.max(maxSlot, i + 1); });
  }
  const showCantrips = sc.enabled && sc.showCantrips && sc.cantrips.some((n) => Number(n) > 0);
  const countCol = sc.enabled ? COUNT_MODES[sc.countMode]?.column : null;
  const showPrepared = !!countCol;

  const head = [
    "<th>Level</th>", "<th>Proficiency Bonus</th>", '<th class="feat-col">Class Features</th>',
    ...cls.columns.map((c) => `<th>${esc(c.name)}</th>`),
    showCantrips ? "<th>Cantrips</th>" : "",
    showPrepared ? `<th>${countCol}</th>` : "",
    pact ? "<th>Spell Slots</th><th>Slot Level</th>" : "",
    ...Array.from({ length: maxSlot }, (_, i) => `<th class="slot">${i + 1}</th>`),
  ].join("");

  const rows = LEVELS.map((l) => {
    const names = entries.filter((e) => e.level === l).map((e) => esc(e.name || "Untitled"));
    const slots = maxSlot ? slotsFor(sc, l, cls.ruleset) : [];
    return `<tr>
      <td>${is2014(cls) ? ordinal(l) : l}</td><td>+${profBonus(l)}</td><td class="feat-col">${names.join(", ") || "—"}</td>
      ${cls.columns.map((c) => `<td>${esc(c.values[l - 1]) || "—"}</td>`).join("")}
      ${showCantrips ? `<td>${Number(sc.cantrips[l - 1]) ? esc(sc.cantrips[l - 1]) : "—"}</td>` : ""}
      ${showPrepared ? `<td>${Number(sc.counts[l - 1]) ? esc(sc.counts[l - 1]) : "—"}</td>` : ""}
      ${pact ? `<td>${PACT.count[l - 1]}</td><td>${PACT.level(l)}</td>` : ""}
      ${Array.from({ length: maxSlot }, (_, i) => `<td class="slot">${slots[i] || "—"}</td>`).join("")}
    </tr>`;
  }).join("");

  const spellGroup = maxSlot
    ? `<tr class="group"><th colspan="${3 + cls.columns.length + (showCantrips ? 1 : 0) + (showPrepared ? 1 : 0)}"></th><th colspan="${maxSlot}">— Spell Slots per Spell Level —</th></tr>`
    : "";

  return `<table class="class-table${maxSlot > 6 ? " dense" : ""}">
    <caption>${is2014(cls) ? "The " : ""}${esc(cls.name || "Class")}${is2014(cls) ? "" : " Features"}</caption>
    <thead>${spellGroup}<tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

function featureBody(f) {
  let html = md(f.body);
  if (f.kind === "choice" && f.options.length) {
    const n = Number(f.choose) || 1;
    if (!f.body.trim()) html += `<p>Choose ${n === 1 ? "one" : n} of the following options.</p>`;
    html += `<div class="options">${f.options.map((o) => {
      const body = md(o.body);
      const runin = `<strong class="runin"><em>${esc(o.name || "Option")}.</em></strong> `;
      return `<div class="option">${body.startsWith("<p>") ? body.replace("<p>", `<p>${runin}`) : `<p>${runin}</p>${body}`}</div>`;
    }).join("")}</div>`;
  }
  return html;
}

function traitsTable(cls) {
  const c = cls.core;
  const name = esc(cls.name || "class");
  const skills = c.skills.length ? `Choose ${c.skillCount}: ${listJoin(c.skills.map(esc), "or")}` : `Choose any ${c.skillCount} skills`;
  const equip = [c.equipmentA && `(A) ${esc(c.equipmentA)}`, c.equipmentB && `(B) ${esc(c.equipmentB)}`, c.equipmentGold > 0 && `(${c.equipmentA && c.equipmentB ? "C" : "B"}) ${c.equipmentGold} GP`].filter(Boolean);
  const rows = [
    ["Primary Ability", esc(c.primaryAbility) || "—"],
    ["Hit Point Die", `D${c.hitDie} per ${name} level`],
    ["Saving Throw Proficiencies", c.saves.length ? listJoin(c.saves.map(esc)) : "—"],
    ["Skill Proficiencies", c.skillCount > 0 ? skills : "None"],
    ["Weapon Proficiencies", esc(c.weapons) || "None"],
    ["Armor Training", esc(c.armor) || "None"],
    c.tools ? ["Tool Proficiencies", esc(c.tools)] : null,
    ["Starting Equipment", equip.length > 1 ? `Choose ${listJoin(equip.map((e) => e.slice(1, 2)), "or")}: ${equip.join("; or ")}` : equip[0] || "—"],
  ].filter(Boolean);
  return `<table class="traits"><caption>Core ${esc(cls.name || "Class")} Traits</caption>
    <tbody>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</tbody></table>`;
}

function spellcastingSection(cls) {
  const sc = cls.spellcasting;
  return `<section class="feature">${featureHeading(cls, Number(sc.level) || 1, sc.name || "Spellcasting")}${md(sc.description)}</section>`;
}

// 2014 layout: Hit Points / Proficiencies / Equipment, as plain labelled lines.
function coreTraits2014(cls) {
  const c = cls.core, name = esc(cls.name || "class"), d = c.hitDie;
  const skills = c.skillCount <= 0 ? "None"
    : c.skills.length ? `Choose ${c.skillCount === 1 ? "one" : c.skillCount === 2 ? "two" : c.skillCount === 3 ? "three" : c.skillCount} from ${listJoin(c.skills.map(esc))}`
    : `Choose any ${c.skillCount}`;
  const items = c.equipmentList.split("\n").map((l) => l.trim()).filter(Boolean);
  const line = (k, v) => `<p class="trait"><strong>${k}:</strong> ${v}</p>`;
  return `<h3>Hit Points</h3>
    ${line("Hit Dice", `1d${d} per ${name} level`)}
    ${line("Hit Points at 1st Level", `${d} + your Constitution modifier`)}
    ${line("Hit Points at Higher Levels", `1d${d} (or ${d / 2 + 1}) + your Constitution modifier per ${name} level after 1st`)}
    <h3>Proficiencies</h3>
    ${line("Armor", esc(c.armor) || "None")}
    ${line("Weapons", esc(c.weapons) || "None")}
    ${line("Tools", esc(c.tools) || "None")}
    ${line("Saving Throws", c.saves.length ? c.saves.map(esc).join(", ") : "None")}
    ${line("Skills", skills)}
    <h3>Equipment</h3>
    <p>You start with the following equipment, in addition to the equipment granted by your background:</p>
    ${items.length ? `<ul class="equipment">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "<p>—</p>"}
    ${c.equipmentWealth ? `<p class="small-note">Alternatively, you can start with ${esc(c.equipmentWealth)} to buy your own equipment.</p>` : ""}`;
}

function spellListSection(cls) {
  const sc = cls.spellcasting;
  const groups = sc.spellList
    .map((txt, lvl) => ({ lvl, spells: txt.split(/[\n,]/).map((s) => s.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b)) }))
    .filter((g) => g.spells.length);
  if (!groups.length) return "";
  return `<h3>${esc(cls.name || "Class")} Spell List</h3>
    ${groups.map((g) => `<h5>${g.lvl === 0 ? (is2014(cls) ? "Cantrips (0 Level)" : "Cantrips (Level 0 Spells)") : is2014(cls) ? `${ordinal(g.lvl)} Level` : `Level ${g.lvl} Spells`}</h5>
      <ul class="spell-list">${g.spells.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`).join("")}`;
}

function subclassSection(cls, s) {
  const feats = [...s.features].sort((a, b) => a.level - b.level);
  return `<section class="subclass">
    ${img(s.header || "devil_header", "header-band", "")}
    <h2 class="subclass-title">${is2014(cls) ? "" : `${esc(cls.name || "Class")} ${esc(cls.subclassTerm || "Subclass")}: `}${esc(s.name || "Untitled")}</h2>
    <div class="flavour">${md(s.flavour)}</div>
    ${spot(s.illustration)}
    ${feats.map((f) => `<section class="feature">${featureHeading(cls, f.level, f.name)}${featureBody(f)}</section>`).join("")}
    ${img("ornamental_angel", "tailpiece", "")}
  </section>`;
}

export function renderDocument(cls) {
  const name = esc(cls.name || "Untitled Class");
  const sc = cls.spellcasting;
  const entries = classFeatureEntries(cls);

  const cover = cls.cover ? `<section class="cover">
      ${img("ornamental_frame", "cover-border left", "")}
      ${img("ornamental_sidebar", "cover-border right", "")}
      <div class="cover-inner">
        <h1 class="cover-title">${name}</h1>
        ${cls.tagline ? `<p class="cover-tagline">${esc(cls.tagline)}</p>` : ""}
        ${img("crest", "cover-crest", "")}
        ${cls.author ? `<p class="cover-author">by ${esc(cls.author)}</p>` : ""}
      </div>
    </section>` : "";

  const epigraph = cls.epigraph.quote
    ? `<blockquote class="epigraph"><p>${esc(cls.epigraph.quote)}</p>${cls.epigraph.attribution ? `<footer>— ${esc(cls.epigraph.attribution)}</footer>` : ""}</blockquote>`
    : "";

  const seen = new Set();
  const features = entries.map((e) => {
    if (e.source === "spellcasting") return spellcastingSection(cls);
    if (e.source === "auto" && is2014(cls)) return ""; // 2014 books only list these in the table
    // A repeat of an earlier feature with no text of its own (e.g. later ASIs) only appears in the table.
    if (!String(e.body || "").trim() && !(e.options || []).length && seen.has((e.name || "").toLowerCase())) return "";
    seen.add((e.name || "").toLowerCase());
    return `<section class="feature">${featureHeading(cls, e.level, e.name)}${featureBody(e)}</section>`;
  }).join("");

  const srd = is2014(cls)
    ? "This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode."
    : "This work includes material from the System Reference Document 5.2 (“SRD 5.2”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.";

  const hp = `<h3>Hit Points</h3>
    <p><strong>Hit Points at Level 1:</strong> ${cls.core.hitDie} + your Constitution modifier.</p>
    <p><strong>Hit Points per Level after 1:</strong> 1d${cls.core.hitDie} (or ${cls.core.hitDie / 2 + 1}) + your Constitution modifier.</p>`;

  return `<article class="doc">
    ${cover}
    <section class="class-main">
      ${img(cls.header || "king_header", "header-band", "")}
      <h1 class="class-title">${name}</h1>
      ${epigraph}
      <div class="flavour dropcap">${md(cls.flavour)}</div>
      ${spot(cls.illustration)}
      ${cls.sections.map((s) => `<h3>${esc(s.title)}</h3>${md(s.body)}${spot(s.illustration)}`).join("")}
      ${is2014(cls) ? "" : traitsTable(cls) + hp}
      ${classTable(cls)}
      ${img("heart_divider", "divider", "")}
      <h2>${is2014(cls) ? "Class Features" : `${name} Class Features`}</h2>
      ${is2014(cls) ? coreTraits2014(cls) : ""}
      ${features}
      ${sc.enabled ? spellListSection(cls) : ""}
      ${img("ornamental_angel", "tailpiece", "")}
    </section>
    ${cls.subclasses.map((s) => subclassSection(cls, s)).join("")}
    <footer class="doc-credits">
      <p>${name} is unofficial homebrew content, not approved or endorsed by Wizards of the Coast.</p>
      <p>${srd}</p>
      <p>Woodcut illustrations courtesy of the Museum Plantin-Moretus, Antwerp.</p>
    </footer>
  </article>`;
}

export { ordinal };
