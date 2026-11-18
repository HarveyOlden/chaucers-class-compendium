// Static game data and presets.
// Spell slot progressions and counts are game mechanics from SRD 5.2 (CC-BY-4.0).
// Double-check the preset counts against the SRD if exactness matters to you.

export const ABILITIES = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];

export const SKILLS = [
  "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History",
  "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception",
  "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival",
];

export const HIT_DICE = [6, 8, 10, 12];

export const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);

export const profBonus = (lvl) => Math.ceil(lvl / 4) + 1;

export const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Full-caster slot table, index = caster level - 1, entries = slots per spell level.
const FULL = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

const pad9 = (row) => Array.from({ length: 9 }, (_, i) => row[i] || 0);

export const RULESETS = {
  "2014": { label: "2014 rules (SRD 5.1)", srd: "5.1" },
  "2024": { label: "2024 rules (SRD 5.2)", srd: "5.2" },
};

// Slot presets take the level and the ruleset. The only difference: 2014 half casters
// get no slots at level 1, 2024 half casters start casting at level 1.
export const SLOT_PRESETS = {
  full: { label: "Full caster (like Wizard, Cleric)", slots: (l) => pad9(FULL[l - 1]) },
  half: { label: "Half caster (like Paladin, Ranger)", slots: (l, rs) => (rs === "2014" && l < 2 ? pad9([]) : pad9(FULL[Math.ceil(l / 2) - 1])) },
  third: { label: "Third caster (usually subclass-only)", slots: (l) => (l < 3 ? pad9([]) : pad9(FULL[Math.ceil(l / 3) - 1])) },
  pact: { label: "Pact Magic (like Warlock)", pact: true },
  custom: { label: "Custom (edit every slot)" },
};

export const PACT = {
  count: [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4],
  level: (l) => Math.min(5, Math.ceil(l / 2)),
};

// How the class table counts spells.
//   prepared: a "Prepared Spells" column (2024 style)
//   known:    a "Spells Known" column (2014 Bard, Sorcerer, Warlock, Ranger)
//   none:     no column; prepare level + modifier, described in the text (2014 Wizard, Cleric...)
export const COUNT_MODES = {
  prepared: { label: "Prepared Spells column", column: "Prepared Spells" },
  known: { label: "Spells Known column", column: "Spells Known" },
  none: { label: "No column (prepare level + modifier)", column: null },
};

const cantrips = (start, at4, at10) => LEVELS.map((l) => (l >= 10 ? at10 : l >= 4 ? at4 : start));
const zeros = () => LEVELS.map(() => 0);
const FULL_PREP = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];

// "Copy counts from" presets for cantrips and spell counts, per ruleset.
export const COUNT_PRESETS = {
  "2024": {
    wizard: { label: "Wizard", mode: "prepared", cantrips: cantrips(3, 4, 5), counts: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25] },
    cleric: { label: "Cleric", mode: "prepared", cantrips: cantrips(3, 4, 5), counts: FULL_PREP },
    druid: { label: "Druid", mode: "prepared", cantrips: cantrips(2, 3, 4), counts: FULL_PREP },
    bard: { label: "Bard", mode: "prepared", cantrips: cantrips(2, 3, 4), counts: FULL_PREP },
    sorcerer: { label: "Sorcerer", mode: "prepared", cantrips: cantrips(4, 5, 6), counts: [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22] },
    warlock: { label: "Warlock", mode: "prepared", cantrips: cantrips(2, 3, 4), counts: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15] },
    half: { label: "Paladin / Ranger", mode: "prepared", cantrips: zeros(), counts: [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15] },
  },
  "2014": {
    wizard: { label: "Wizard (prepares level + Int)", mode: "none", cantrips: cantrips(3, 4, 5), counts: zeros() },
    cleric: { label: "Cleric (prepares level + Wis)", mode: "none", cantrips: cantrips(3, 4, 5), counts: zeros() },
    druid: { label: "Druid (prepares level + Wis)", mode: "none", cantrips: cantrips(2, 3, 4), counts: zeros() },
    bard: { label: "Bard (spells known)", mode: "known", cantrips: cantrips(2, 3, 4), counts: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22] },
    sorcerer: { label: "Sorcerer (spells known)", mode: "known", cantrips: cantrips(4, 5, 6), counts: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15] },
    warlock: { label: "Warlock (spells known)", mode: "known", cantrips: cantrips(2, 3, 4), counts: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15] },
    ranger: { label: "Ranger (spells known)", mode: "known", cantrips: zeros(), counts: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11] },
    paladin: { label: "Paladin (prepares half level + Cha)", mode: "none", cantrips: zeros(), counts: zeros() },
  },
};

export const IMAGES = {
  headers: {
    king_header: "Crowned king",
    devil_header: "Devils & flames",
    prayer_header: "Prayer & angels",
    eagle_header: "Dove & saints",
    lion_header: "Lion & hermit",
  },
  spots: {
    ship: "Ship", battlefield: "Battlefield", hourglass: "Hourglass", mask: "Moon face", tree: "Tree",
    psuedo_d20: "Polyhedron", geometry: "Cone diagram", creatures: "Hare, fox & tortoise", gods: "Statues",
    turnip: "Turnip", angel: "Angel", beseech: "Gathering", crest: "Crest",
  },
  tabs: {
    overview: "ship",
    core: "psuedo_d20",
    features: "battlefield",
    progression: "hourglass",
    spellcasting: "mask",
    subclasses: "tree",
  },
};

let idCounter = 0;
export const uid = () => Date.now().toString(36) + (idCounter++).toString(36) + Math.random().toString(36).slice(2, 6);

export const newFeature = (level = 1, name = "New Feature") => ({
  id: uid(), level, name, kind: "standard", body: "", choose: 1, options: [],
});

export const newSubclass = () => ({
  id: uid(), name: "New Subclass", header: "devil_header", illustration: "", flavour: "", features: [],
});

export const SCHEMA_VERSION = 1;

export function defaultClass(ruleset = "2014") {
  const is2014 = ruleset === "2014";
  return {
    schema: SCHEMA_VERSION,
    ruleset,
    name: "",
    tagline: "",
    author: "",
    header: "king_header",
    illustration: "",
    cover: true,
    epigraph: { quote: "", attribution: "" },
    flavour: "",
    sections: [],
    core: {
      primaryAbility: "",
      hitDie: 8,
      saves: [],
      skillCount: 2,
      skills: [],
      weapons: "Simple weapons",
      armor: "",
      tools: "",
      equipmentA: "",
      equipmentB: "",
      equipmentGold: 0,
      equipmentList: "",
      equipmentWealth: "",
    },
    subclassTerm: "Subclass",
    subclassLevels: [3, 6, 10, 14],
    columns: [],
    features: [
      newFeature(3, "Subclass"),
      { ...newFeature(4, "Ability Score Improvement"), body: is2014
        ? "When you reach 4th level, and again at 8th, 12th, 16th, and 19th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. You can't increase an ability score above 20 using this feature."
        : "You gain the Ability Score Improvement feat or another feat of your choice for which you qualify. You gain this feature again at levels 8, 12, and 16." },
      newFeature(8, "Ability Score Improvement"),
      newFeature(12, "Ability Score Improvement"),
      newFeature(16, "Ability Score Improvement"),
      is2014 ? newFeature(19, "Ability Score Improvement")
        : { ...newFeature(19, "Epic Boon"), body: "You gain an Epic Boon feat or another feat of your choice for which you qualify." },
      newFeature(20, "Capstone"),
    ],
    spellcasting: {
      enabled: false,
      name: "Spellcasting",
      level: 1,
      ability: "Intelligence",
      description: "",
      progression: "full",
      showCantrips: true,
      countMode: COUNT_PRESETS[ruleset].wizard.mode,
      cantrips: COUNT_PRESETS[ruleset].wizard.cantrips.slice(),
      counts: COUNT_PRESETS[ruleset].wizard.counts.slice(),
      customSlots: LEVELS.map((l) => SLOT_PRESETS.full.slots(l)),
      spellList: Array.from({ length: 10 }, () => ""),
    },
    subclasses: [],
  };
}
