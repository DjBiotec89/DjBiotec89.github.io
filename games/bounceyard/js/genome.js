// BOUNCEYARD – Murmel-Genom, Fusion und Sprite-Baukasten
// Jede Murmel wird durch ein Genom beschrieben. Fusion A+B ist deterministisch (gleiches Paar = gleiches Ergebnis),
// Sprites werden zur Laufzeit aus Körper, Kopfteil, Muster, Farben und Gesicht pixelgenau zusammengesetzt.

export const ELEMENTS = {
  feuer:    { name: 'Feuer',    color: '#ff7a2a', text: 'Treffer setzen in Brand.' },
  wasser:   { name: 'Wasser',   color: '#4fb4e8', text: 'Treffer spritzen auf Nachbarn.' },
  metall:   { name: 'Metall',   color: '#a3aabb', text: '+0.5 Schaden, durchbricht Panzer.' },
  feder:    { name: 'Feder',    color: '#fff6d0', text: '+10 % Tempo, schwebt länger.' },
  blitz:    { name: 'Blitz',    color: '#ffe14d', text: 'Treffer springen auf 1 Gegner über.' },
  gift:     { name: 'Gift',     color: '#7ad35a', text: 'Treffer vergiften.' },
  eis:      { name: 'Eis',      color: '#bfefff', text: 'Treffer verlangsamen.' },
  erde:     { name: 'Erde',     color: '#a8743f', text: '+1 Herz, schwere Treffer.' },
  licht:    { name: 'Licht',    color: '#ffe48a', text: '+12 % kritische Treffer.' },
  schatten: { name: 'Schatten', color: '#6a4a9a', text: '15 % Chance, durch Gegner zu gleiten.' },
};
const EL_KEYS = Object.keys(ELEMENTS);
const HYBRID = {
  'feuer+wasser': 'Dampf', 'feuer+metall': 'Schmiede', 'feuer+feder': 'Phönix', 'feuer+blitz': 'Plasma', 'feuer+gift': 'Säurebrand', 'feuer+eis': 'Frostbrand', 'feuer+erde': 'Magma', 'feuer+licht': 'Sonne', 'feuer+schatten': 'Höllenglut',
  'wasser+metall': 'Rost', 'wasser+feder': 'Nebel', 'wasser+blitz': 'Sturm', 'wasser+gift': 'Sumpf', 'wasser+eis': 'Hagel', 'wasser+erde': 'Schlamm', 'wasser+licht': 'Regenbogen', 'wasser+schatten': 'Tiefsee',
  'metall+feder': 'Klinge', 'metall+blitz': 'Magnetik', 'metall+gift': 'Quecksilber', 'metall+eis': 'Stahlfrost', 'metall+erde': 'Erz', 'metall+licht': 'Chrom', 'metall+schatten': 'Eisenschatten',
  'feder+blitz': 'Donnervogel', 'feder+gift': 'Sporen', 'feder+eis': 'Schneesturm', 'feder+erde': 'Staub', 'feder+licht': 'Engel', 'feder+schatten': 'Rabe',
  'blitz+gift': 'Neon', 'blitz+eis': 'Polarlicht', 'blitz+erde': 'Beben', 'blitz+licht': 'Laser', 'blitz+schatten': 'Schwarzblitz',
  'gift+eis': 'Frostgift', 'gift+erde': 'Moder', 'gift+licht': 'Fluoreszenz', 'gift+schatten': 'Seuche',
  'eis+erde': 'Permafrost', 'eis+licht': 'Kristall', 'eis+schatten': 'Nachtfrost', 'erde+licht': 'Bernstein', 'erde+schatten': 'Grab', 'licht+schatten': 'Zwielicht',
};
export function elementName(els) {
  if (els.length === 1) return ELEMENTS[els[0]].name;
  const a = EL_KEYS.indexOf(els[0]) < EL_KEYS.indexOf(els[1]) ? els[0] + '+' + els[1] : els[1] + '+' + els[0];
  const base = HYBRID[a] || ELEMENTS[els[0]].name;
  return els.length > 2 ? 'Ur-' + base : base;
}

export const TRIGGERS = {
  tippen:   { name: 'Tippen',   text: 'Tippen im Flug' },
  abprall:  { name: 'Abprall',  text: 'Bei jedem Abprall' },
  wand:     { name: 'Wand',     text: 'Jeder 3. Wandtreffer' },
  abschuss: { name: 'Abschuss', text: 'Jeder 4. Abschuss' },
};
export const EFFECTS = {
  schubs:  { name: 'Schubs',      text: 'schiesst zum Ziel' },
  platsch: { name: 'Platsch',     text: 'spritzt 2 Mini-Murmeln ab' },
  ramme:   { name: 'Rammbock',    text: 'rammt senkrecht durch alles' },
  feder:   { name: 'Sprungfeder', text: 'prallt nach oben und wird schneller' },
  nova:    { name: 'Nova',        text: 'explodiert ringsum' },
  strahl:  { name: 'Strahl',      text: 'feuert einen Lichtstrahl nach oben' },
  stern:   { name: 'Sternwurf',   text: 'wirft 3 Zielsuchsterne' },
  kette:   { name: 'Kettenblitz', text: 'trifft 3 Gegner mit Blitzen' },
};
export const MUTATIONS = {
  schimmernd: { name: 'Schimmernd', text: '+1 Glanz pro Raum' },
  riesig:     { name: 'Riesig',     text: 'Grösser, +0.5 Schaden' },
  zwilling:   { name: 'Zwilling',   text: 'Startet jeden Raum mit einer Mini-Murmel' },
  flink:      { name: 'Flink',      text: '+12 % Tempo' },
  zaeh:       { name: 'Zäh',        text: '+2 Herzen' },
};

// ---------------------------------------------------------------- 30 Grundmurmeln
const B = (key, name, body, head, pat, col, acc, el, trig, eff, hearts, dmg, speed, cost, minBest = 0, png = false) => ({ id: key, key, name, body, head, pat, col, acc, els: [el], trig, eff, hearts, dmg, speed, gen: 0, mut: null, cost, minBest, png });
export const BASE = [
  B('nib', 'NIB', 'rund', 'spross', 'none', '#f1ede2', '#6fcf5f', 'erde', 'tippen', 'schubs', 5, 1, 1.0, 0, 0, true),
  B('bloop', 'BLOOP', 'tropfen', 'none', 'none', '#8fd7ff', '#e8fbff', 'wasser', 'tippen', 'platsch', 4, 1, 1.05, 3, 0, true),
  B('clonk', 'CLONK', 'rund', 'helm', 'none', '#f49d5d', '#a3aabb', 'metall', 'tippen', 'ramme', 6, 1.4, 0.9, 5, 0, true),
  B('pogo', 'POGO', 'breit', 'feder', 'none', '#ff86c8', '#ffe07c', 'feder', 'tippen', 'feder', 4, 1, 1.1, 8, 0, true),
  B('zisch', 'ZISCH', 'rund', 'flamme', 'none', '#ff8a3a', '#ffd45c', 'feuer', 'tippen', 'nova', 4, 1.1, 1.0, 10),
  B('brummel', 'BRUMMEL', 'wuerfel', 'hoerner', 'streifen', '#9a76d0', '#ffd45c', 'blitz', 'abprall', 'kette', 5, 1, 0.95, 12),
  B('frosti', 'FROSTI', 'ei', 'none', 'sterne', '#bfefff', '#ffffff', 'eis', 'wand', 'stern', 5, 1, 1.0, 12),
  B('moosi', 'MOOSI', 'wolke', 'blatt', 'punkte', '#6fae5a', '#b6e88a', 'gift', 'tippen', 'platsch', 5, 0.9, 1.0, 14),
  B('glimm', 'GLIMM', 'stern', 'none', 'none', '#ffe48a', '#fff6d0', 'licht', 'abschuss', 'strahl', 4, 1, 1.05, 15),
  B('schatti', 'SCHATTI', 'rund', 'ohren', 'halb', '#4a3f7a', '#ff5a6e', 'schatten', 'tippen', 'schubs', 4, 1.2, 1.05, 16),
  B('kiesel', 'KIESEL', 'wuerfel', 'none', 'punkte', '#9a8676', '#c9cbd6', 'erde', 'abprall', 'ramme', 7, 1.2, 0.85, 18),
  B('funki', 'FUNKI', 'tropfen', 'antenne', 'none', '#ffe14d', '#6fd0f0', 'blitz', 'tippen', 'kette', 4, 1, 1.1, 18),
  B('lotti', 'LOTTI', 'herz', 'schleife', 'none', '#ff86b0', '#fff0f6', 'licht', 'abprall', 'feder', 5, 1, 1.05, 20),
  B('hagel', 'HAGEL', 'diamant', 'none', 'streifen', '#68cae8', '#e8fbff', 'eis', 'tippen', 'ramme', 5, 1.2, 0.95, 20),
  B('pilzi', 'PILZI', 'pilz', 'none', 'punkte', '#d87366', '#fff6d0', 'gift', 'abschuss', 'nova', 5, 1, 1.0, 22),
  B('rubi', 'RUBI', 'diamant', 'krone', 'none', '#e84e5a', '#ffd45c', 'feuer', 'wand', 'strahl', 4, 1.3, 1.0, 24),
  B('wolki', 'WOLKI', 'wolke', 'none', 'none', '#f4f7ff', '#9fd8f0', 'feder', 'wand', 'schubs', 5, 0.9, 1.15, 24),
  B('tauchi', 'TAUCHI', 'ei', 'flosse', 'bauch', '#4d9fc7', '#bfefff', 'wasser', 'abprall', 'stern', 5, 1, 1.0, 26),
  B('nachti', 'NACHTI', 'rund', 'hoerner', 'sterne', '#2f2a5a', '#ffe48a', 'schatten', 'abschuss', 'kette', 4, 1.2, 1.05, 28, 10),
  B('blinki', 'BLINKI', 'rund', 'antenne', 'bauch', '#c9cbd6', '#6fd0f0', 'metall', 'wand', 'kette', 6, 1.2, 0.95, 28, 10),
  B('hasi', 'HASI', 'ei', 'hasenohren', 'bauch', '#fff6ea', '#ffc4e0', 'feder', 'tippen', 'feder', 4, 1, 1.15, 30, 10),
  B('magmi', 'MAGMI', 'breit', 'flamme', 'halb', '#8a3a3a', '#ff7a2a', 'feuer', 'abprall', 'nova', 6, 1.3, 0.9, 32, 15),
  B('sporli', 'SPORLI', 'rund', 'blatt', 'sterne', '#9be070', '#ffd45c', 'gift', 'wand', 'platsch', 5, 1, 1.0, 32, 15),
  B('polar', 'POLAR', 'rund', 'ohren', 'bauch', '#e8fbff', '#9fd8f0', 'eis', 'abschuss', 'ramme', 7, 1.2, 0.9, 34, 15),
  B('sonni', 'SONNI', 'stern', 'krone', 'none', '#ffba4c', '#fff27a', 'licht', 'tippen', 'nova', 5, 1.2, 1.0, 36, 20),
  B('klecks', 'KLECKS', 'tropfen', 'none', 'punkte', '#6a4a9a', '#c08bff', 'schatten', 'abprall', 'platsch', 5, 1.1, 1.05, 38, 20),
  B('donni', 'DONNI', 'wolke', 'antenne', 'streifen', '#6b7083', '#ffe14d', 'blitz', 'abschuss', 'strahl', 5, 1.2, 1.0, 40, 25),
  B('nugget', 'NUGGET', 'wuerfel', 'krone', 'streifen', '#ffcf4a', '#fff6d0', 'metall', 'abschuss', 'stern', 6, 1.3, 0.95, 44, 30),
  B('stachi', 'STACHI', 'ei', 'stacheln', 'streifen', '#5fbf5f', '#fff6d0', 'erde', 'wand', 'nova', 7, 1.3, 0.9, 48, 35),
  B('prismo', 'PRISMO', 'diamant', 'antenne', 'sterne', '#c8b8ff', '#ffffff', 'licht', 'abprall', 'strahl', 5, 1.4, 1.05, 55, 40),
];
// Seltenheit der ersten 30 nach Preis, dann 30 neue Automaten-Murmeln
BASE.forEach((g) => (g.rar = g.cost <= 20 ? 'normal' : g.cost <= 30 ? 'selten' : g.cost <= 40 ? 'episch' : 'legendaer'));
const N = (rar, key, name, body, head, pat, col, acc, els, trig, eff, hearts, dmg, speed, mut = null, face) => ({ id: key, key, name, body, head, pat, col, acc, els: [].concat(els), trig, eff, hearts, dmg, speed, gen: 0, mut, cost: 0, minBest: 0, rar, face });
BASE.push(
  N('normal', 'knopf', 'KNOPF', 'rund', 'none', 'punkte', '#d9a066', '#fff6d0', 'erde', 'abprall', 'schubs', 5, 1, 1.0),
  N('normal', 'spritz', 'SPRITZ', 'tropfen', 'antenne', 'none', '#6fe0c0', '#e8fbff', 'wasser', 'wand', 'platsch', 4, 1, 1.05),
  N('normal', 'fluff', 'FLUFF', 'wolke', 'ohren', 'none', '#ffd9ec', '#ffffff', 'feder', 'tippen', 'feder', 4, 0.9, 1.1),
  N('normal', 'rosti', 'ROSTI', 'wuerfel', 'helm', 'streifen', '#b0663a', '#a3aabb', 'metall', 'abprall', 'ramme', 6, 1.1, 0.9),
  N('normal', 'blubb', 'BLUBB', 'pilz', 'none', 'bauch', '#9ad0ff', '#fffcf0', 'wasser', 'abschuss', 'platsch', 5, 1, 1.0),
  N('normal', 'zapp', 'ZAPP', 'ei', 'antenne', 'streifen', '#fff27a', '#6b7083', 'blitz', 'wand', 'kette', 4, 1, 1.05),
  N('selten', 'gluti', 'GLUTI', 'breit', 'hoerner', 'punkte', '#ff5a3a', '#ffd45c', 'feuer', 'abschuss', 'nova', 5, 1.2, 1.0, null, 'angry'),
  N('selten', 'minzi', 'MINZI', 'herz', 'blatt', 'none', '#8ff0c0', '#fffcf0', 'gift', 'tippen', 'stern', 5, 1, 1.05),
  N('selten', 'krista', 'KRISTA', 'diamant', 'krone', 'sterne', '#bfefff', '#ffffff', 'eis', 'abprall', 'strahl', 4, 1.2, 1.05),
  N('selten', 'schnex', 'SCHNEX', 'ei', 'hasenohren', 'punkte', '#ffffff', '#bfefff', 'eis', 'tippen', 'schubs', 5, 1, 1.1),
  N('selten', 'bolz', 'BOLZ', 'wuerfel', 'stacheln', 'none', '#8a8fa3', '#ff5a6e', 'metall', 'tippen', 'ramme', 7, 1.3, 0.85, null, 'angry'),
  N('selten', 'wispi', 'WISPI', 'wolke', 'none', 'sterne', '#c8b8ff', '#fff6d0', 'schatten', 'wand', 'feder', 4, 1.1, 1.15, null, 'sleepy'),
  N('selten', 'koralli', 'KORALLI', 'stern', 'flosse', 'punkte', '#ff8a7a', '#ffd9ec', 'wasser', 'abschuss', 'stern', 5, 1.1, 1.0),
  N('selten', 'summi', 'SUMMI', 'rund', 'antenne', 'streifen', '#ffcf4a', '#2b1d3a', 'blitz', 'abprall', 'platsch', 5, 1, 1.1),
  N('selten', 'pilzo', 'PILZO', 'pilz', 'krone', 'punkte', '#9a76d0', '#fff6d0', 'gift', 'wand', 'nova', 6, 1.1, 0.95),
  N('episch', 'vulko', 'VULKO', 'breit', 'flamme', 'halb', '#5a2a2a', '#ff7a2a', 'feuer', 'tippen', 'ramme', 7, 1.4, 0.9, null, 'angry'),
  N('episch', 'gletsch', 'GLETSCH', 'wuerfel', 'helm', 'sterne', '#68cae8', '#ffffff', 'eis', 'abschuss', 'kette', 7, 1.3, 0.9),
  N('episch', 'orakel', 'ORAKEL', 'ei', 'krone', 'sterne', '#6a4a9a', '#ffe48a', 'licht', 'wand', 'stern', 5, 1.3, 1.05, null, 'sleepy'),
  N('episch', 'turbo', 'TURBO', 'tropfen', 'feder', 'streifen', '#ff4a6e', '#fffcf0', 'feder', 'abprall', 'schubs', 4, 1.2, 1.2),
  N('episch', 'magno', 'MAGNO', 'rund', 'hoerner', 'halb', '#c9cbd6', '#ff5a6e', 'metall', 'wand', 'kette', 6, 1.3, 1.0),
  N('episch', 'sumpfi', 'SUMPFI', 'breit', 'blatt', 'bauch', '#4f7a3a', '#9be070', 'gift', 'abprall', 'nova', 7, 1.2, 0.95),
  N('legendaer', 'drako', 'DRAKO', 'breit', 'hoerner', 'streifen', '#e84e5a', '#ffd45c', 'feuer', 'tippen', 'strahl', 7, 1.6, 1.0, 'riesig', 'angry'),
  N('legendaer', 'aurora', 'AURORA', 'stern', 'antenne', 'sterne', '#8ff0e0', '#ff86c8', 'licht', 'abprall', 'kette', 6, 1.5, 1.1, 'flink'),
  N('legendaer', 'titano', 'TITANO', 'wuerfel', 'krone', 'halb', '#6b7083', '#ffd45c', 'metall', 'abschuss', 'ramme', 9, 1.6, 0.9, 'zaeh', 'angry'),
  N('legendaer', 'nebula', 'NEBULA', 'wolke', 'hoerner', 'sterne', '#3a2a6a', '#c08bff', 'schatten', 'tippen', 'nova', 6, 1.5, 1.1, 'schimmernd'),
  N('legendaer', 'komet', 'KOMET', 'diamant', 'feder', 'streifen', '#6fd0f0', '#fffcf0', 'blitz', 'abprall', 'strahl', 6, 1.5, 1.15, 'flink'),
  N('mythisch', 'phoenia', 'PHOENIA', 'stern', 'flamme', 'sterne', '#ff9a3a', '#fff27a', ['feuer', 'feder'], 'tippen', 'stern', 7, 1.8, 1.15, 'zwilling'),
  N('mythisch', 'levia', 'LEVIA', 'tropfen', 'flosse', 'sterne', '#2a6ab0', '#8fffe0', ['wasser', 'schatten'], 'abprall', 'platsch', 8, 1.8, 1.05, 'riesig'),
  N('mythisch', 'kosmo', 'KOSMO', 'rund', 'antenne', 'sterne', '#1a1438', '#ffd45c', ['licht', 'schatten'], 'abschuss', 'strahl', 7, 1.9, 1.1, 'schimmernd'),
  N('mythisch', 'gaia', 'GAIA', 'herz', 'spross', 'bauch', '#6fcf5f', '#ff86c8', ['erde', 'licht'], 'wand', 'nova', 9, 1.7, 1.0, 'zaeh'),
);
export const BASE_BY = Object.fromEntries(BASE.map((g) => [g.key, g]));
export const RAR = {
  normal:    { name: 'Normal',   color: '#c9cbd6', rate: 52 },
  selten:    { name: 'Selten',   color: '#4fb4e8', rate: 28 },
  episch:    { name: 'Episch',   color: '#b07cff', rate: 13.5 },
  legendaer: { name: 'Legendär', color: '#ffcf4a', rate: 5 },
  mythisch:  { name: 'Mythisch', color: '#ff4a7a', rate: 1.5 },
};
export const RAR_KEYS = Object.keys(RAR);
export function rarOf(g) { return g.rar || (BASE_BY[g.key] && BASE_BY[g.key].rar) || 'normal'; }

// ---------------------------------------------------------------- Werte
export function power(g) { return g.hearts * 1.2 + g.dmg * 4 + g.speed * 3 + g.gen * 2 + (g.mut ? 2 : 0) + g.els.length + RAR_KEYS.indexOf(rarOf(g)) * 0.6; }
export function stars(g) { return Math.max(1, Math.min(5, Math.round((power(g) - 12) / 2.2))); }
export function stats(g) {
  let hearts = g.hearts + (g.els.includes('erde') ? 1 : 0) + (g.mut === 'zaeh' ? 2 : 0);
  let dmg = g.dmg + (g.els.includes('metall') ? 0.5 : 0) + (g.mut === 'riesig' ? 0.5 : 0);
  let speed = g.speed * (g.els.includes('feder') ? 1.1 : 1) * (g.mut === 'flink' ? 1.12 : 1);
  return { hearts: Math.round(hearts), dmg: Math.round(dmg * 10) / 10, speed: Math.round(speed * 100) / 100 };
}
export function skillText(g) { return `${TRIGGERS[g.trig].text}: ${EFFECTS[g.eff].text}.`; }

// ---------------------------------------------------------------- Fusion
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let s = seed || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16); const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  return [h, s, l];
}
function hslToHex(h, s, l) {
  const f = (n) => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(c * 255).toString(16).padStart(2, '0'); };
  return '#' + f(0) + f(8) + f(4);
}
function mixHue(a, b, t, shift) {
  const A = hexToHsl(a), Bc = hexToHsl(b);
  let dh = Bc[0] - A[0]; if (dh > 0.5) dh -= 1; if (dh < -0.5) dh += 1;
  const h = (A[0] + dh * t + shift + 1) % 1;
  return hslToHex(h, Math.min(0.95, A[1] + (Bc[1] - A[1]) * t), Math.min(0.85, Math.max(0.25, A[2] + (Bc[2] - A[2]) * t)));
}
const BODIES = ['rund', 'tropfen', 'wuerfel', 'ei', 'breit', 'stern', 'diamant', 'herz', 'wolke', 'pilz'];
const HEADS = ['none', 'spross', 'helm', 'feder', 'flamme', 'hoerner', 'blatt', 'ohren', 'antenne', 'schleife', 'krone', 'flosse', 'hasenohren', 'stacheln'];
const PATTERNS = ['none', 'punkte', 'streifen', 'halb', 'bauch', 'sterne'];
const SYL_A = ['BLI', 'KRO', 'ZUM', 'FIP', 'MOR', 'TAL', 'QUI', 'NUB', 'SCHN', 'PLO'];
const VOW = 'AEIOUÄÖÜY';
function headSyl(n) { let i = 0; while (i < n.length && !VOW.includes(n[i])) i++; while (i < n.length && VOW.includes(n[i])) i++; return n.slice(0, Math.min(n.length, i + 1)); }
function tailSyl(n) { let i = n.length - 1; while (i > 0 && !VOW.includes(n[i])) i--; while (i > 0 && VOW.includes(n[i - 1])) i--; return n.slice(Math.max(0, i - 1)); }
const BAD = ['POOP', 'KACK', 'PUPS', 'NAZI', 'SEX', 'FICK', 'ARSCH'];
function fuseName(a, b, r) {
  let n = (headSyl(a.name) + tailSyl(b.name)).replace(/(.)\1\1+/g, '$1$1').replace(/([AEIOU])\1/g, '$1');
  if (n.length > 9) n = n.slice(0, 9);
  if (n.length < 3 || n === a.name || n === b.name || BAD.some((w) => n.includes(w))) n = SYL_A[(r() * SYL_A.length) | 0] + tailSyl(b.name);
  return n;
}
export function fuseId(a, b) { const [x, y] = [a.id, b.id].sort(); return 'f' + hash(x + '|' + y).toString(36); }
export function fuse(a, b) {
  const [p1, p2] = [a, b].sort((x, y) => (x.id < y.id ? -1 : 1));
  const id = fuseId(a, b); const r = rng(hash(id));
  const dom = power(p1) >= power(p2) ? p1 : p2, sub = dom === p1 ? p2 : p1;
  const mutate = r() < 0.12;
  const els = [...new Set([...p1.els, ...p2.els])].slice(0, 3);
  const gen = Math.max(p1.gen, p2.gen) + 1;
  const g = {
    id, key: id, name: fuseName(dom, sub, r),
    body: r() < 0.1 ? BODIES[(r() * BODIES.length) | 0] : dom.body,
    head: sub.head !== 'none' ? (r() < 0.1 ? HEADS[(r() * HEADS.length) | 0] : sub.head) : dom.head,
    pat: r() < 0.5 ? dom.pat : r() < 0.7 ? sub.pat : PATTERNS[(r() * PATTERNS.length) | 0],
    col: mixHue(dom.col, sub.col, 0.4, (r() - 0.5) * 0.08), acc: r() < 0.5 ? sub.col : mixHue(dom.acc, sub.acc, 0.5, 0),
    els, trig: p1.trig, eff: p2.eff === p1.eff ? (r() < 0.5 ? p1.eff : Object.keys(EFFECTS)[(r() * 8) | 0]) : p2.eff,
    hearts: Math.round((p1.hearts + p2.hearts) / 2 + 0.5), dmg: Math.round(((p1.dmg + p2.dmg) / 2 * 1.08 + 0.05 * gen) * 10) / 10,
    speed: Math.round(((p1.speed + p2.speed) / 2 + (r() - 0.5) * 0.06) * 100) / 100,
    gen, mut: mutate ? Object.keys(MUTATIONS)[(r() * 5) | 0] : (dom.mut && r() < 0.5 ? dom.mut : null),
    face: r() < 0.25 ? 'angry' : r() < 0.15 ? 'sleepy' : 'cute', parents: [p1.name, p2.name], pids: [p1.id, p2.id],
  };
  const ri = Math.max(RAR_KEYS.indexOf(rarOf(p1)), RAR_KEYS.indexOf(rarOf(p2))) + (r() < 0.2 || rarOf(p1) === rarOf(p2) && r() < 0.35 ? 1 : 0);
  g.rar = RAR_KEYS[Math.min(4, ri)];
  return g;
}

// ---------------------------------------------------------------- Sprite-Baukasten (16×16, 14 Frames)
const INK = [43, 29, 58];
const FLAT = { k: INK, w: [255, 252, 240], c: [255, 140, 165], r: [232, 78, 90], y: [255, 214, 92], h: [255, 255, 248] };
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixC = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const lighter = (c, t) => mixC(c, [255, 250, 235], t), darker = (c, t) => mixC(c, [60, 30, 90], t);

class Raster {
  constructor(w = 16, h = 16) { this.w = w; this.h = h; this.m = Array.from({ length: h }, () => Array(w).fill('.')); this.mats = {}; }
  mat(ch, col) { this.mats[ch] = typeof col === 'string' ? rgb(col) : col; }
  px(x, y, ch) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.m[y][x] = ch; }
  ell(cx, cy, rx, ry, ch, cut) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1 && (!cut || cut(x, y))) this.m[y][x] = ch; } }
  rect(x, y, w, h, ch) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, ch); }
  poly(pts, ch) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { let ins = false; const px = x + 0.5, py = y + 0.5; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) ins = !ins; } if (ins) this.m[y][x] = ch; } }
  stamp(x, y, rows, mirror) { rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') { this.px(x + i, y + j, ch); if (mirror) this.px(this.w - 1 - (x + i), y + j, ch); } })); }
  render(ctx, ox, oy) {
    const img = Array.from({ length: this.h }, () => Array(this.w).fill(null));
    for (const [ch, col] of Object.entries(this.mats)) {
      let x0 = 99, x1 = -1, y0 = 99, y1 = -1;
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.m[y][x] === ch) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      if (x1 < 0) continue;
      const cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2, rx = Math.max(1, (x1 - x0 + 1) / 2), ry = Math.max(1, (y1 - y0 + 1) / 2);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (this.m[y][x] !== ch) continue;
        const l = ((x + 0.5 - cx) / rx) * -0.6 + ((y + 0.5 - cy) / ry) * -0.8;
        let c = col;
        if (l > 0.6) c = lighter(col, 0.42); else if (l > 0.22) c = lighter(col, 0.2);
        else if (l < -0.36 || (l < -0.18 && (x + y) % 2 === 0)) c = darker(col, 0.24);
        if (y === this.h - 1 || this.m[y + 1][x] === '.') c = darker(col, 0.42);
        else if (y > 0 && this.m[y - 1][x] !== ch && this.mats[this.m[y - 1][x]]) c = darker(col, 0.3);
        img[y][x] = c;
      }
    }
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const f = FLAT[this.m[y][x]]; if (f) img[y][x] = f; }
    const out = img.map((r) => r.slice());
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (img[y][x]) continue;
      const nb = [[0, 1], [1, 0], [0, -1], [-1, 0]].map(([dx, dy]) => [dx, dy, img[y + dy] && img[y + dy][x + dx]]).filter((n) => n[2]);
      if (!nb.length) continue;
      const lit = nb.every(([dx, dy]) => dx >= 0 && dy >= 0);
      out[y][x] = lit && this.mats[this.m[y + nb[0][1]][x + nb[0][0]]] ? mixC(darker(nb[0][2], 0.55), INK, 0.35) : INK;
    }
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (out[y][x]) { ctx.fillStyle = `rgb(${out[y][x].join(',')})`; ctx.fillRect(ox + x, oy + y, 1, 1); }
  }
}

function face(s, fy, kind, cx = 8, sp = 3) {
  const L = cx - sp - 1, R = cx + sp;
  if (kind === 'sleepy') { for (const x of [L, R - 1]) { s.px(x, fy + 1, 'k'); s.px(x + 1, fy + 1, 'k'); } }
  else for (const x of [L, R - 1]) { s.rect(x, fy, 2, 2, 'k'); s.px(x, fy, 'w'); }
  if (kind === 'angry') { s.px(L - 1, fy - 2, 'k'); s.px(L, fy - 2, 'k'); s.px(L + 1, fy - 1, 'k'); s.px(R + 1, fy - 2, 'k'); s.px(R, fy - 2, 'k'); s.px(R - 1, fy - 1, 'k'); }
  if (kind !== 'angry') { s.px(L - 1, fy + 2, 'c'); s.px(R + 1, fy + 2, 'c'); }
}
function mouth(s, fy, kind, cx = 8) {
  const y = fy + 3;
  if (kind === 'open') { s.px(cx - 1, y, 'k'); s.px(cx, y, 'k'); s.px(cx - 1, y + 1, 'r'); s.px(cx, y + 1, 'r'); }
  else if (kind === 'o') { s.rect(cx - 1, y, 2, 2, 'k'); }
  else if (kind === 'cat') { s.px(cx - 2, y, 'k'); s.px(cx - 1, y + 1, 'k'); s.px(cx, y, 'k'); s.px(cx + 1, y + 1, 'k'); }
  else { s.px(cx - 1, y, 'k'); s.px(cx, y, 'k'); }
}

function body(s, kind, cy, sq) {
  const rx = 6 + (sq ? 1 : 0), ry = 6 - (sq ? 1 : 0);
  switch (kind) {
    case 'rund': s.ell(8, cy, rx, ry, 'b'); break;
    case 'tropfen': s.ell(8, cy + 0.5, rx - 0.5, ry - 0.5, 'b'); s.poly([[8, cy - ry - 2.5], [12, cy - 2], [4, cy - 2]], 'b'); break;
    case 'wuerfel': s.rect(3 - (sq ? 1 : 0), cy - ry + 1, 10 + (sq ? 2 : 0), ry * 2 - 1, 'b'); s.ell(8, cy, rx + 0.3, ry + 0.3, 'b', (x, y) => y > cy - ry + 0.5 && y < cy + ry - 1); break;
    case 'ei': s.ell(8, cy + 0.3, rx - 0.6, ry + 0.4, 'b'); break;
    case 'breit': s.ell(8, cy + 0.6, rx + 0.6, ry - 0.6, 'b'); break;
    case 'stern': { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.8 : 7.2; pts.push([8 + Math.cos(a) * r * (sq ? 1.1 : 1), cy + 0.5 + Math.sin(a) * r * (sq ? 0.85 : 1)]); } s.poly(pts, 'b'); s.ell(8, cy + 0.5, 3.6, 3.6, 'b'); break; }
    case 'diamant': s.poly([[8, cy - ry - 1], [8 + rx + 1, cy], [8, cy + ry + 0.5], [8 - rx - 1, cy]], 'b'); break;
    case 'herz': s.ell(5.3, cy - 1.5, 3.4, 3.2, 'b'); s.ell(10.7, cy - 1.5, 3.4, 3.2, 'b'); s.poly([[1.6, cy - 1], [14.4, cy - 1], [8, cy + ry + 0.5]], 'b'); break;
    case 'wolke': s.ell(5, cy + 0.5, 3.6, 3.4, 'b'); s.ell(11, cy + 0.5, 3.6, 3.4, 'b'); s.ell(8, cy - 1.5, 4.2, 3.8, 'b'); s.ell(8, cy + 2, 5.5, 3, 'b'); break;
    case 'pilz': s.mat('S', '#f7e6cc'); s.ell(8, cy + 3, 4, 3, 'S'); s.ell(8, cy - 1, rx + 1, ry - 1.5, 'b', (x, y) => y < cy + 1); break;
  }
}
function pattern(s, kind, cy) {
  const inB = (x, y) => s.m[y] && s.m[y][x] === 'b';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!inB(x, y)) continue;
    if (kind === 'punkte' && ((x * 7 + y * 13) % 11 === 0)) s.m[y][x] = 'a';
    if (kind === 'streifen' && y % 4 === 0 && y > cy - 5) s.m[y][x] = 'a';
    if (kind === 'halb' && y > cy + 1) s.m[y][x] = 'a';
    if (kind === 'bauch' && ((x + 0.5 - 8) / 3.5) ** 2 + ((y + 0.5 - cy - 2.5) / 2.5) ** 2 <= 1) s.m[y][x] = 'a';
    if (kind === 'sterne' && ((x * 5 + y * 3) % 13 === 0)) s.m[y][x] = 'h';
  }
}
function head(s, kind, top, k, g) {
  switch (kind) {
    case 'spross': s.mat('G', '#6fcf5f'); s.px(8, top - 1, 'G'); s.stamp(9, top - 3 + (k === 2 ? 1 : 0), ['GG', 'G.']); break;
    case 'helm': s.mat('M', '#a3aabb'); s.ell(8, top + 4, 6.6, 5, 'M', (x, y) => y < top + 3); s.px(8, top - 1, 'M'); s.px(5, top + 2, 'y'); s.px(11, top + 2, 'y'); break;
    case 'feder': s.mat('M', '#c9cbd6'); s.rect(7, top - 2, 2, 2, 'M'); s.px(6, top - 1, 'M'); s.px(9, top - 1, 'M'); s.mat('Y', '#ffe07c'); s.ell(8, top - 3.2, 1.8, 1.8, 'Y'); break;
    case 'flamme': s.mat('F', '#ff7a2a'); s.stamp(5, top - 4 + (k % 2), ['..F.F.', '.FFFF.', 'FFyyFF', '.FyyF.']); break;
    case 'hoerner': s.mat('H', '#fff6d0'); s.stamp(3, top - 2, ['H.', 'HH', '.H'], true); break;
    case 'blatt': s.mat('G', '#6fcf5f'); s.stamp(6, top - 3, ['.GG.', 'GGGG', '..G.']); break;
    case 'ohren': s.ell(3.5, top + 1.5, 2.2, 2.2, 'b'); s.ell(12.5, top + 1.5, 2.2, 2.2, 'b'); break;
    case 'hasenohren': s.stamp(4, top - 4, ['b.', 'bc', 'bc', 'bb'], true); break;
    case 'antenne': s.mat('K', '#3d2b52'); s.px(8, top - 1, 'K'); s.px(8, top - 2, 'K'); s.mat('Y', '#ffe14d'); s.ell(8, top - 3, 1.5, 1.5, 'Y'); break;
    case 'schleife': s.mat('R', '#ff5a6e'); s.stamp(4, top - 1, ['RR..RR', 'RRRRRR', 'RR..RR']); s.px(7, top, 'y'); s.px(8, top, 'y'); break;
    case 'krone': s.mat('Y', '#ffd45c'); s.stamp(4, top - 3, ['Y..Y..Y.'.slice(0, 7), 'YY.YY.YY'.slice(0, 7), 'YYYYYYY'.slice(0, 7)]); s.px(7, top - 1, 'r'); break;
    case 'flosse': s.mat('A', g.acc); s.stamp(7, top - 3, ['.A', 'AA', 'AA']); break;
    case 'stacheln': s.mat('H', '#fff6d0'); for (const x of [4, 7, 10]) { s.px(x, top - 1, 'H'); s.px(x + 1, top - 2, 'H'); } break;
  }
}

export function drawFrame(ctx, g, f, ox = 0, oy = 0) {
  const s = new Raster();
  const st = f < 4 ? 'idle' : f < 8 ? 'fly' : f < 10 ? 'hit' : 'skill', k = f % 4;
  const cy = 9 + (st === 'idle' && (k === 1 || k === 2) ? 1 : 0);
  s.mat('b', g.col); s.mat('a', g.acc);
  body(s, g.body, cy, st === 'hit');
  pattern(s, g.pat, cy);
  // Oberkante des Körpers suchen
  let top = 15; for (let y = 0; y < 16; y++) if (s.m[y].includes('b')) { top = y; break; }
  head(s, g.head, top, k, g);
  const fy = cy - 1 - (st === 'fly' ? 1 : 0);
  if (st === 'hit') { face(s, fy, 'sleepy'); mouth(s, fy, 'o'); }
  else { face(s, fy, g.face || 'cute'); mouth(s, fy, st === 'skill' ? 'open' : g.face === 'angry' ? 'smile' : 'cat'); }
  if (g.body !== 'wuerfel') s.px(5, cy - 3, 'h');
  s.render(ctx, ox, oy);
  if (st === 'skill' || g.mut === 'schimmernd') {
    const ec = rgb(ELEMENTS[g.els[0]].color);
    ctx.fillStyle = `rgb(${ec.join(',')})`;
    for (const [x, y] of [[1, 2], [14, 3], [0, 12], [15, 11]].slice(k % 2, k % 2 + 2)) ctx.fillRect(ox + x, oy + y, 1, 1);
  }
}
const sheetCache = new Map();
export function sheetCanvas(g) {
  if (sheetCache.has(g.id)) return sheetCache.get(g.id);
  const c = document.createElement('canvas'); c.width = 16 * 14; c.height = 16; const ctx = c.getContext('2d');
  for (let f = 0; f < 14; f++) drawFrame(ctx, g, f, f * 16, 0);
  sheetCache.set(g.id, c); return c;
}
