// BOUNCEYARD – Roguelike-Ricochet-Breakout (Prototyp Kapitel 1: Kullerhain)
import * as THREE from '../vendor/three.module.min.js';
import { LW, LH, renderer, scene, camera, manager, tex, img, canvasTex, Sprite, rect, placeRect, quad, emit, updateParticles, clearParticles, FXQ } from './pixel.js';
import { MARBLES, ENEMIES, POWERUPS, RARITY, EVENTS, BOSS, SYNERGIES, BIOMES, EVENT_LEVELS, PLATFORMS } from './content.js';
const PLAT_BY = Object.fromEntries(PLATFORMS.map((p) => [p.id, p]));
PLATFORMS.forEach((p) => tex(`assets/plat/${p.id}.png`));
import { Audio } from './audio.js';
import { BASE, BASE_BY, fuse, sheetCanvas, drawFrame, stats as gStats, stars, skillText, elementName, ELEMENTS, TRIGGERS, EFFECTS, MUTATIONS, RAR, RAR_KEYS, rarOf } from './genome.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
renderer.domElement.className = 'gl';
stage.prepend(renderer.domElement);
const sfx = new Audio();

// ---------------------------------------------------------------- Konstanten
const WALL = 8, TOP = 18, PLAT_Y = 250, DANGER = 210, GRAV = 85, BASE_SPEED = 172;
const COLS = 10, COL_X = (c) => 18 + c * 16, ROW_Y = (r) => 46 + r * 16;
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const pick = (a) => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------------------------------------------------------------- Speicherstand
const SAVE_KEY = 'bounceyard_rogue_v1';
const save = Object.assign({ glanz: 0, unlocked: { nib: true }, best: 0, runs: 0, wins: 0, sel: 'nib', sound: true, inv: null, cores: 0, book: {}, ws: {}, uidN: 1, selU: null, plats: { moos: true }, platSel: 'moos' }, (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } })());
function addInv(g) { const uid = save.uidN++; save.inv.push({ uid, g }); save.book[g.id] = g; return uid; }
function initMeta() {
  if (!save.inv) { save.inv = []; for (const k of Object.keys(save.unlocked)) if (BASE_BY[k]) addInv(BASE_BY[k]); }
  if (!save.inv.length) { save.unlocked.nib = true; addInv(BASE_BY.nib); }
  if (!save.inv.some((x) => x.uid === save.selU)) save.selU = save.inv[0].uid;
}
const selItem = () => save.inv.find((x) => x.uid === save.selU);
const ws = (k) => save.ws[k] || 0;
const buzz = (p) => { if (save.vib !== false && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} };
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };

// ---------------------------------------------------------------- Assets vorladen
const ENEMY_KEYS = Object.keys(ENEMIES);
ENEMY_KEYS.forEach((k) => tex(`assets/enemies/${k}.png`));
tex('assets/misc/e_shot.png'); tex('assets/ui/i_warn.png');
BIOMES.forEach((b) => { tex(`assets/enemies/${b.boss}.png`); tex(`assets/biomes/${b.id}/platform.png`); });
BASE.filter((g) => g.png).forEach((g) => tex(`assets/chars/${g.key}.png`));
['platform', 'coin', 'heart', 'crown', 'alert', 'bumper', 'fx_saw0', 'fx_rocket', 'fx_hole0', 'fx_ember', 'fx_star', 'fx_spike', 'p_seed', 'p_slime', 'p_spark', 'p_rock', 'p_ice', 'p_pellet', 'shard', 'drone', 'shadow'].forEach((k) => tex(`assets/misc/${k}.png`));
const BT = BIOMES.map((b) => ({ g: [0, 1, 2, 3].map((i) => img(`assets/biomes/${b.id}/floor_${i}.png`)), hedge: img(`assets/biomes/${b.id}/wall.png`) }));
let TILE = BT[0];
const MAPI = {}; ['kampf', 'elite', 'schatz', 'laden', 'rast', 'ereignis', 'boss', 'sonder'].forEach((k) => (MAPI[k] = img(`assets/map/${k}.png`)));
const CHARI = {}; BASE.filter((g) => g.png).forEach((g) => (CHARI[g.key] = img(`assets/chars/${g.key}.png`)));
const gTexCache = {};
function gTex(g) { if (g.png) return tex(`assets/chars/${g.key}.png`); if (!gTexCache[g.id]) gTexCache[g.id] = canvasTex(sheetCanvas(g)); return gTexCache[g.id]; }
function gImg(g) { return g.png ? CHARI[g.key] : sheetCanvas(g); }

// Mini-Murmel-Texturen (8×8) zur Laufzeit
function miniTex(col) {
  const c = document.createElement('canvas'); c.width = c.height = 8; const g = c.getContext('2d');
  const rows = ['..kkkk..', '.kccccк.', 'kchcccck', 'kccccddk', 'kccccddk', 'kcccdddk', '.kdddkk.', '..kkkk..'];
  const pal = { k: '#2b1d3a', c: col, h: '#ffffff', d: shade(col, 0.72) };
  rows.forEach((r, y) => [...r].forEach((ch, x) => { const p = pal[ch === 'к' ? 'k' : ch]; if (p) { g.fillStyle = p; g.fillRect(x, y, 1, 1); } }));
  return canvasTex(c);
}
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); const r = ((n >> 16) & 255) * f, gg = ((n >> 8) & 255) * f, b = (n & 255) * f; return `rgb(${r | 0},${gg | 0},${b | 0})`; }
const MINI = {}; const miniFor = (col) => MINI[col] || (MINI[col] = miniTex(col));

// ---------------------------------------------------------------- Hintergrund (Kacheln)
let bgMesh = null;
function drawGrass(g, w, h, seed = 1) {
  let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) {
    const v = r(); g.drawImage(TILE.g[v < 0.7 ? 0 : v < 0.84 ? 1 : v < 0.94 ? 2 : 3], x, y);
  }
}
function drawHedge(g, x, y, w, h) { for (let yy = y; yy < y + h; yy += 8) for (let xx = x; xx < x + w; xx += 8) g.drawImage(TILE.hedge, xx, yy); }
const bgCache = {};
function edgeBg(bi) {
  const st = document.getElementById('stage'); if (!st) return; const r = st.getBoundingClientRect(), u = r.width / LW;
  const b = document.body.style; b.backgroundImage = `url(assets/biomes/${BIOMES[bi].id}/wall.png)`; b.backgroundSize = `${8 * u}px ${8 * u}px`; b.backgroundPosition = `${r.left}px ${r.top}px`; b.backgroundRepeat = 'repeat'; b.imageRendering = 'pixelated';
  edgeBg.bi = bi;
}
addEventListener('resize', () => edgeBg(edgeBg.bi || 0));
function buildBg(bi = 0) {
  edgeBg(bi);
  TILE = BT[bi];
  if (bgCache[bi]) { if (bgMesh) bgMesh.material.map = bgCache[bi]; else bgMesh = quad(bgCache[bi], 0, 0, LW, LH, 0); return; }
  const c = document.createElement('canvas'); c.width = LW; c.height = LH; const g = c.getContext('2d');
  drawGrass(g, LW, LH, 7);
  drawHedge(g, 0, 0, WALL, LH); drawHedge(g, LW - WALL, 0, WALL, LH); drawHedge(g, 0, 0, LW, TOP);
  g.fillStyle = '#2b1d3a'; g.fillRect(WALL, TOP, LW - WALL * 2, 1); g.fillRect(WALL - 1, TOP, 1, LH); g.fillRect(LW - WALL, TOP, 1, LH);
  g.fillStyle = 'rgba(43,29,58,0.35)'; g.fillRect(WALL, TOP + 1, LW - WALL * 2, 2); g.fillRect(WALL, TOP, 2, LH);
  // Steuerzone unter der Plattform
  const zy = PLAT_Y + 16; g.fillStyle = 'rgba(43,29,58,0.42)'; g.fillRect(WALL, zy, LW - WALL * 2, LH - zy);
  g.fillStyle = 'rgba(255,252,240,0.35)'; g.fillRect(WALL, zy, LW - WALL * 2, 1);
  g.fillStyle = 'rgba(255,252,240,0.5)';
  const cy = zy + 18; for (const [x, d] of [[70, -1], [110, 1]]) for (let i = 0; i < 4; i++) g.fillRect(x + d * i, cy - i, 1, i * 2 + 1);
  for (let x = 78; x <= 102; x += 4) g.fillRect(x, cy, 2, 1);
  bgCache[bi] = canvasTex(c);
  if (bgMesh) bgMesh.material.map = bgCache[bi]; else bgMesh = quad(bgCache[bi], 0, 0, LW, LH, 0);
}

// ---------------------------------------------------------------- Zustand
const G = {
  mode: 'title', auto: false, hitstop: 0, t: 0, shake: 0, hint: '', run: null, room: null,
  ptr: { down: false, x: 90, y: 200, sx: 0, sy: 0, t0: 0, moved: 0, zone: null }, keys: {}, dialog: null,
};
const world = new THREE.Group(); scene.add(world);

// Gefahrenlinie & Zielpunkte
const dangerDots = []; for (let x = WALL + 2; x < LW - WALL; x += 4) dangerDots.push(rect(x, DANGER, 2, 1, '#ff5a6e', 3, 0.35, world));
const inkRect = rect(WALL, TOP, LW - WALL * 2, DANGER - TOP + 6, '#2b1d3a', 26, 0, world);
const aimDots = Array.from({ length: 22 }, () => rect(0, 0, 1, 1, '#fffcf0', 25, 1, world));
const bossBarBg = rect(30, TOP + 4, 120, 4, '#2b1d3a', 40, 1, world), bossBar = rect(31, TOP + 5, 118, 2, '#ff5a6e', 41, 1, world);
bossBarBg.visible = bossBar.visible = false;

// ---------------------------------------------------------------- Run
function lvl(k) { return G.run ? G.run.pu[k] || 0 : 0; }
const FXC = {}; const fx = (k) => (FXC[k] = (FXC[k] || 0) + 1);
const PL = () => (G.run ? G.run.P : PLAT_BY.moos);
function elF(el) { if (!G.run) return 0; const i = G.run.g.els.indexOf(el); return i < 0 ? 0 : [1, 0.7, 0.5][i]; }
const SYN = Object.fromEntries(SYNERGIES.map((x) => [x.id, x]));
function syn(id) { const x = SYN[id]; return lvl(x.a) > 0 && lvl(x.b) > 0; }
function synergiesFor(k) { return SYNERGIES.filter((x) => (x.a === k && lvl(x.b) && !lvl(k)) || (x.b === k && lvl(x.a) && !lvl(k))); }
function newRun(g) {
  const st = gStats(g); const m = { name: g.name, dmg: st.dmg, speed: st.speed, color: g.col, hearts: st.hearts + ws('herz') };
  save.book[g.id] = g;
  const P = PLAT_BY[save.platSel] || PLAT_BY.moos; if (P.gold) m.hearts = Math.max(1, m.hearts - 1);
  G.run = { g, P, mk: g.key, m, hearts: m.hearts, maxHearts: m.hearts, cores: 0, eggs: 0, rerolls: ws('reroll'), coins: 25 * ws('gold'), pu: {}, order: [], kills: 0, rooms: 0, glanz: 0, map: genMap(), node: null, floor: 0, chapter: 0, vampKills: 0 };
  save.runs++; persist();
  if (ws('start')) { const k = pick(Object.keys(POWERUPS).filter((k) => POWERUPS[k].r === 'common')); applyPU(k); }
  showMap();
}

// ---------------------------------------------------------------- Karte
const MAP_ROWS = 10;
const CH = () => (G.run ? G.run.chapter : 0);
const GL = () => (G.run ? G.run.chapter * MAP_ROWS + G.run.floor : 0);
const BIO = () => BIOMES[CH()];
const MROW_Y = (r) => 262 - r * 23;
function genMap() {
  const rows = [];
  const W = ['kampf', 'kampf', 'kampf', 'elite', 'ereignis', 'sonder', 'schatz', 'laden', 'rast'];
  for (let r = 0; r < MAP_ROWS; r++) {
    let types;
    if (r === MAP_ROWS - 1) types = ['boss'];
    else if (r === MAP_ROWS - 2) types = shuffle(['rast', 'laden']);
    else if (r === 0) types = ['kampf', pick(['kampf', 'ereignis'])];
    else if (r === 4) types = shuffle(['schatz', pick(['sonder', 'laden', 'elite'])]);
    else { const k = r >= 2 && Math.random() < 0.55 ? 3 : 2; types = []; for (let i = 0; i < 60 && types.length < k; i++) { const t = pick(W); if (!types.includes(t)) types.push(t); } if (!types.some((t) => t === 'kampf' || t === 'elite') && r >= 2) types[0] = 'kampf'; }
    if (r === 4 && Math.random() < 0.5) types.push(pick(['kampf', 'ereignis']));
    const SX = types.length === 1 ? [90] : types.length === 2 ? [48, 132] : [30, 90, 150];
    rows.push(types.map((type, i) => ({ r, i, f: types.length === 1 ? 0.5 : i, type, x: SX[i], y: MROW_Y(r), next: [], done: false, ev: type === 'sonder' ? pick(Object.keys(EVENT_LEVELS)) : null })));
  }
  for (let r = 0; r < MAP_ROWS - 1; r++) for (const n of rows[r]) n.next = rows[r + 1];
  return rows;
}
function availNodes() { const R = G.run; return R.node ? R.node.next : R.map[0]; }

const mapCv = $('mapCanvas'), mg = mapCv.getContext('2d');
let mapBase = null;
const UI = (n) => img(`assets/ui/${n}.png`);
const TOKI = {}; ['kampf', 'elite', 'schatz', 'laden', 'rast', 'ereignis', 'sonder', 'boss'].forEach((t) => ['on', 'off', 'done'].forEach((st) => (TOKI[t + st] = UI(`tok_${t}_${st}`))));
const DECO = {}; BIOMES.forEach((b) => (DECO[b.id] = [UI(`deco_${b.id}_0`), UI(`deco_${b.id}_1`)]));
const PATHI = UI('path');
const NODE_INFO = {
  kampf: ['Kampf', 'Gegner besiegen – danach 1 von 3 Power-ups.'],
  elite: ['Elite', 'Ein starker Gegner. Seltenes Power-up, Chance auf Fusionskern.'],
  schatz: ['Schatz', 'Ein seltenes Power-up und 20 Münzen.'],
  laden: ['Laden', 'Power-ups und Herzen kaufen.'],
  rast: ['Rastplatz', 'Heilen oder ein Power-up verbessern.'],
  ereignis: ['Ereignis', 'Eine Überraschung wartet.'],
};
function nodeInfo(n) {
  if (n.type === 'sonder') { const e = EVENT_LEVELS[n.ev]; return [e.name, e.text]; }
  if (n.type === 'boss') return [BIO().bossName, 'Der Wächter dieses Bioms. Sieg = nächstes Kapitel.'];
  return NODE_INFO[n.type];
}
const GLI = {}; ['kampf', 'elite', 'schatz', 'laden', 'rast', 'ereignis', 'sonder', 'boss', 'off'].forEach((t) => { GLI['l' + t] = UI('gl_' + t); GLI['s' + t] = UI('gs_' + t); });
const GEAR = [UI('gear0'), UI('gear1')], TRICHTER = UI('trichter'), BOLT = UI('bolt');
function pipe(g, x1, y1, x2, y2, col = '#c9cbd6') {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))));
  for (const [w, c] of [[5, '#2b1d3a'], [3, col], [1, '#fffcf0']]) {
    g.fillStyle = c;
    for (let i = 0; i <= steps; i++) { const x = Math.round(x1 + (x2 - x1) * i / steps), y = Math.round(y1 + (y2 - y1) * i / steps); g.fillRect(x - (w >> 1) - (c === '#fffcf0' ? 1 : 0), y - (w >> 1), w, w); }
  }
}
// ===== Kugelautomat
const AM = { globe: UI('am_globe'), cap: UI('am_cap'), body: UI('am_body'), tray: UI('am_tray'), crank: [0, 1, 2, 3].map((i) => UI('am_crank' + i)), balls: [0, 1, 2, 3, 4, 5, 6].map((i) => UI('am_ball' + i)), top32: UI('cap_top32'), top44: UI('cap_top44') };
const CAPB = {}; ['kampf', 'elite', 'schatz', 'laden', 'rast', 'ereignis', 'sonder', 'boss'].forEach((t) => (CAPB[t] = UI('cap_bot_' + t)));
const GLOBE_C = [90, 104];
function pilePositions(n) {
  const out = []; const rows = [[138, [68, 79, 90, 101, 112]], [128, [62, 73, 84, 95, 106, 117]], [118, [68, 79, 90, 101, 112]], [108, [73, 84, 95, 106]]];
  for (const [y, xs] of rows) for (const x of xs) if (out.length < n) out.push([x, y]);
  return out;
}
// ===== Murmelbahn (Seitenansicht)
const MR_SW = [90, 120], MR_ST = 226;
function resample(pts, step = 1) {
  const out = [pts[0]]; let acc = 0;
  for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; const d = Math.hypot(bx - ax, by - ay); let t = step - acc; while (t <= d) { out.push([ax + (bx - ax) * t / d, ay + (by - ay) * t / d]); t += step; } acc = (acc + d) % step; }
  out.push(pts[pts.length - 1]); return out;
}
function bez(p0, p1, p2, p3, n = 40) { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); } return o; }
const MR_ENTRY = resample([...bez([-8, 34], [60, 36], [120, 44], [156, 54]), ...bez([156, 54], [172, 60], [168, 74], [140, 78]), ...bez([140, 78], [80, 84], [30, 84], [24, 96]), ...bez([24, 96], [20, 110], [60, 118], MR_SW)]);
function branchPts(sx) { return resample(bez(MR_SW, [MR_SW[0] + (sx - MR_SW[0]) * 0.55, 136], [sx, 168], [sx, MR_ST])); }
function drawPosts(g, pts, every = 34) {
  for (let i = Math.min(10, pts.length - 1); i < pts.length; i += every) { const [x, y] = pts[i]; if (x < 4 || x > 176) continue; const X = Math.round(x) - 1, Y = Math.round(y) + 2;
    g.fillStyle = '#2b1d3a'; g.fillRect(X - 1, Y, 5, 262 - Y); g.fillStyle = '#8a5a3a'; g.fillRect(X, Y, 3, 262 - Y); g.fillStyle = '#b07a4a'; g.fillRect(X, Y, 1, 262 - Y);
    g.fillStyle = '#2b1d3a'; g.fillRect(X - 3, 259, 9, 4); g.fillStyle = '#6b7083'; g.fillRect(X - 2, 260, 7, 2); }
}
function drawRail(g, pts, col = '#c9cbd6', hl = '#fffcf0', dash = 0) {
  g.fillStyle = '#2b1d3a'; for (const [x, y] of pts) g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
  pts.forEach(([x, y], i) => { g.fillStyle = dash && Math.floor(i / 5) % 2 ? shade(col, 0.75) : col; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); });
  g.fillStyle = hl; for (let i = 0; i < pts.length; i += 2) { const [x, y] = pts[i]; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 1, 1); }
  g.fillStyle = '#6b7083'; for (let i = 3; i < pts.length; i += 7) { const [x, y] = pts[i]; g.fillRect(Math.round(x), Math.round(y) + 2, 1, 2); }
}
function drawMapBase() {
  const c = document.createElement('canvas'); c.width = LW; c.height = LH; const g = c.getContext('2d');
  TILE = BT[CH()];
  drawGrass(g, LW, LH, 99 + CH());
  g.fillStyle = 'rgba(26,18,36,0.45)'; g.fillRect(0, 0, LW, LH);
  drawHedge(g, 0, 0, LW, 16);
  g.fillStyle = 'rgba(26,18,36,0.35)'; g.fillRect(0, 262, LW, 58);
  g.drawImage(DECO[BIO().id][0], 4, 240); g.drawImage(DECO[BIO().id][1], 160, 244);
  drawPosts(g, MR_ENTRY, 64); drawRail(g, MR_ENTRY);
  // Bumper an den Kurven
  for (const [x, y] of [[163, 66], [21, 96]]) { g.fillStyle = '#2b1d3a'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.fillStyle = '#ff5a6e'; g.beginPath(); g.arc(x, y, 3.6, 0, 7); g.fill(); g.fillStyle = '#ffd0d8'; g.fillRect(x - 2, y - 2, 1, 1); }
  mapBase = c;
}
function amReset() {
  const av = availNodes();
  G.mr = { ph: 'in', t: 0, br: av.map((n) => ({ n, pts: branchPts(n.x) })), sel: null };
}
function stationDraw(g, n, x, t, on) {
  const col = { kampf: '#e8565f', elite: '#9a76d0', schatz: '#ffcf4a', laden: '#6fd36a', rast: '#ff9a4a', ereignis: '#6fd0f0', sonder: '#ff86c8', boss: '#ffd45c' }[n.type];
  const big = n.type === 'boss', w = big ? 30 : 24, X = Math.round(x - w / 2), Y = MR_ST;
  // Beine
  g.fillStyle = '#2b1d3a'; g.fillRect(X + 2, Y + 28, 5, 262 - Y - 28); g.fillRect(X + w - 7, Y + 28, 5, 262 - Y - 28);
  g.fillStyle = '#6b7083'; g.fillRect(X + 3, Y + 28, 3, 262 - Y - 28); g.fillRect(X + w - 6, Y + 28, 3, 262 - Y - 28);
  // Trichter
  for (let k = 0; k < 6; k++) { const ww = w + 8 - k; g.fillStyle = '#2b1d3a'; g.fillRect(Math.round(x - ww / 2) - 1, Y + k, ww + 2, 1); g.fillStyle = k === 0 ? '#fffcf0' : col; g.fillRect(Math.round(x - ww / 2), Y + k, ww, 1); }
  g.fillStyle = '#1a1224'; g.fillRect(Math.round(x) - 3, Y + 1, 6, 3);
  // Kasten mit Icon
  const by = Y + 6, bob = on ? Math.round(Math.sin(t * 6)) : 0;
  g.fillStyle = on ? '#ffd45c' : '#2b1d3a'; g.fillRect(X - 1, by, w + 2, 23);
  g.fillStyle = shade(col, 0.55); g.fillRect(X, by + 1, w, 21); g.fillStyle = shade(col, 0.8); g.fillRect(X, by + 1, w, 2);
  g.fillStyle = '#3d2b52'; g.fillRect(Math.round(x) - 9, by + 3, 18, 18);
  g.drawImage(MAPI[n.type], Math.round(x) - 8, by + 4 + bob);
  if (on) { g.fillStyle = Math.floor(t * 8) % 2 ? '#ffd45c' : '#fffcf0'; for (let a = 0; a < 10; a++) { const an = a / 10 * Math.PI * 2 + t; g.fillRect(Math.round(x + Math.cos(an) * (w / 2 + 6)), Math.round(by + 11 + Math.sin(an) * 16), 1, 1); } }
}
function drawMap() {
  if (!mapBase) return;
  const R = G.run, M = G.mr; if (!M) return;
  const t = G.t, dt = Math.min(0.05, t - (M.lt ?? t)); M.lt = t; M.t += dt;
  mg.clearRect(0, 0, LW, LH); mg.drawImage(mapBase, 0, 0);
  for (const b of M.br) drawPosts(mg, b.pts.slice(30, 60), 100);
  for (const b of M.br) if (b !== M.sel) drawRail(mg, b.pts, '#8a8fa3', '#c9cbd6', 1);
  if (M.sel) drawRail(mg, M.sel.pts, '#ffd45c', '#fff6d0');
  for (const b of M.br) stationDraw(mg, b.n, b.n.x, t, b === M.sel);
  // Weiche
  const [wx, wy] = MR_SW; const tgt = M.sel ? M.sel.pts[12] : [wx, wy + 12]; const an = Math.atan2(tgt[1] - wy, tgt[0] - wx);
  mg.fillStyle = '#2b1d3a'; mg.beginPath(); mg.arc(wx, wy, 6, 0, 7); mg.fill(); mg.fillStyle = '#ffd45c'; mg.beginPath(); mg.arc(wx, wy, 4.5, 0, 7); mg.fill();
  for (let i = 0; i < 10; i++) { mg.fillStyle = i < 2 ? '#2b1d3a' : '#c9cbd6'; mg.fillRect(Math.round(wx + Math.cos(an) * i) - 1, Math.round(wy + Math.sin(an) * i) - 1, 2, 2); }
  // Murmel
  let px, py;
  if (M.ph === 'in') { const k = Math.min(1, M.t / 1.3), e = 1 - (1 - k) * (1 - k); const p = MR_ENTRY[Math.min(MR_ENTRY.length - 1, Math.floor(e * (MR_ENTRY.length - 1)))]; [px, py] = p; if (k >= 1) { M.ph = 'idle'; M.t = 0; } }
  else if (M.ph === 'roll') { const k = Math.min(1, M.t / 0.75), e = k * k; const p = M.sel.pts[Math.min(M.sel.pts.length - 1, Math.floor(e * (M.sel.pts.length - 1)))]; [px, py] = p; if (Math.random() < 0.5) emit(px, py, '#ffd45c', 1, 20); if (k >= 1 && !M.done) { M.done = true; emit(px, py + 8, '#fffcf0', 14, 60); sfx.play('pop'); setTimeout(() => G.mode === 'map' && enterNode(M.sel.n), 160); } }
  else { [px, py] = MR_SW; py -= Math.abs(Math.sin(t * 4)) * 2; }
  const fr = Math.floor(t * 8) % 4;
  mg.drawImage(gImg(R.g), fr * 16, 0, 16, 16, Math.round(px) - 8, Math.round(py) - 14, 16, 16);
  if (M.ph === 'idle' && !M.sel) for (const b of M.br) { const q = b.pts[30 + (Math.floor(t * 20) % (b.pts.length - 40))]; mg.fillStyle = '#fffcf0'; mg.fillRect(Math.round(q[0]), Math.round(q[1]) - 1, 1, 1); }
}
function showMap() {
  setMode('map'); drawMapBase(); amReset(); G.mapSel = null; G.mapRoll = null; $('mapInfo').classList.remove('on'); $('mapHint').style.display = 'block'; $('mapHint').textContent = 'Wähle deine Bahn!';
  const cur = G.run.node ? G.run.node.r + 1 : 0;
  $('mapTop').textContent = BIO().name;
  $('mapPips').innerHTML = Array.from({ length: MAP_ROWS }, (_, i) => `<i class="${i < cur ? 'on' : i === cur ? 'cur' : ''}"></i>`).join('');
  sfx.startMusic(CH(), false);
  updateHud();
  if (G.auto) setTimeout(() => G.mode === 'map' && enterNode(pick(availNodes())), 30);
}
function selectNode(n) {
  G.mapSel = n; sfx.play('ui');
  const [t, d] = nodeInfo(n);
  const RW = { kampf: ['ui/st_pu', 'misc/coin'], elite: ['ui/st_pu', 'misc/kern', 'misc/glanz'], schatz: ['ui/st_pu', 'misc/coin'], laden: ['misc/coin', 'ui/st_pu', 'misc/heart'], rast: ['misc/heart', 'ui/i_werk'], ereignis: ['ui/st_mut'], sonder: ['ui/st_pu', 'misc/coin'], boss: ['misc/kern', 'ui/st_ei', 'misc/glanz'] }[n.type];
  $('miIcon').src = `assets/map/${n.type}.png`; $('miTitle').textContent = t; $('miText').innerHTML = d + `<div class="rew">${RW.map((r) => `<span><img class="px" src="assets/${r}.png"></span>`).join('')}</div>`;
  $('mapHint').style.display = 'none'; $('mapInfo').classList.add('on');
}
function mrGo() { const M = G.mr; if (!M || !M.sel || M.ph === 'roll') return; M.ph = 'roll'; M.t = 0; M.done = false; $('mapInfo').classList.remove('on'); sfx.play('launch'); }
$('miGo').onclick = () => { if (G.mapSel) mrGo(); };
function rollTo(n) { if (G.mapRoll) return; const R = G.run; G.mapRoll = { n, t0: G.t, sy: R.node ? R.node.y + 9 : 286 }; $('mapInfo').classList.remove('on'); sfx.play('launch'); setTimeout(() => { G.mapRoll = null; enterNode(n); }, 520); }
mapCv.addEventListener('pointerdown', (ev) => {
  if (G.mode !== 'map') return; sfx.unlock();
  const b = mapCv.getBoundingClientRect(); const x = (ev.clientX - b.left) / b.width * LW, y = (ev.clientY - b.top) / b.height * LH;
  const M = G.mr; if (!M || M.ph === 'roll') return;
  let best = null, bd = 16;
  for (const b of M.br) { if (Math.abs(b.n.x - x) < 16 && y > MR_ST - 44 && y < MR_ST + 30) { best = b; break; } for (let i = 14; i < b.pts.length; i += 3) { const d = Math.hypot(b.pts[i][0] - x, b.pts[i][1] - y); if (d < bd) { bd = d; best = b; } } }
  if (best) { if (M.sel === best && $('mapInfo').classList.contains('on')) return mrGo(); M.sel = best; selectNode(best.n); }
});
function enterNode(n) {
  $('mapInfo').classList.remove('on'); G.mapSel = null;
  const R = G.run; R.pending = n; R.floor = n.r; sfx.play('ui');
  if (n.type === 'kampf' || n.type === 'elite' || n.type === 'boss') startRoom(n.type);
  else if (n.type === 'sonder') { const ev = EVENT_LEVELS[n.ev]; openDialog({ head: ev.name, text: `<div class="biome"><img class="px" src="assets/map/sonder.png" style="width:calc(var(--u)*32);height:calc(var(--u)*32)"><div class="small">${ev.text}</div><div class="chips">${ev.time ? chip(UIC('st_tempo'), ev.time + ' Sekunden', '#6fd0f0') : ''}${chip(UIC('st_pu'), 'Besondere Belohnung', '#c08bff')}</div></div>`, buttons: [{ label: 'Los!', fn: () => { closeDialog(); startRoom('sonder', n.ev); } }] }); }
  else if (n.type === 'schatz' && Math.random() < 0.2) { R.coins += 20; relicChoice('Schatz!', finishNode); }
  else if (n.type === 'schatz') { R.coins += 20; puChoice('Schatz!', 'Wähle ein seltenes Power-up · +20 Münzen', 'rare', finishNode); }
  else if (n.type === 'laden') openShop();
  else if (n.type === 'rast') openRest();
  else if (n.type === 'ereignis') openEvent();
}
function nextChapter() {
  const R = G.run; R.chapter++; R.map = genMap(); R.node = null; R.floor = 0; R.glanz += 3;
  R.hearts = Math.min(R.maxHearts, R.hearts + 2); buildBg(R.chapter);
  const B = BIO(); sfx.play('win');
  openDialog({ head: `Kapitel ${R.chapter + 1}`, text: `<div class="biome"><div class="bn">${B.name}</div><div class="small">${B.sub}</div><div class="bossview" style="background-image:url(assets/enemies/${B.boss}.png)"></div><div class="small" style="color:#ff5a6e">Boss: ${B.bossName}</div><div class="chips">${chip(MIC('heart'), '+2 Herzen', '#ff5a6e')}${chip(MIC('glanz'), '+3 Glanz', '#ffd45c')}</div></div>`, buttons: [{ label: 'Weiter', fn: () => { closeDialog(); showMap(); } }] });
}
// ===== Relikte
const RELICS = {
  zorn:     { name: 'Zornkrone',      col: '#ff4a3a', text: 'Gegner haben 30 % weniger Leben, schiessen aber 50 % öfter.' },
  sanduhr:  { name: 'Sanduhr',        col: '#bfefff', text: 'Gegnerschüsse 25 % langsamer, deine Murmel 10 % langsamer.' },
  glas:     { name: 'Glasherz',       col: '#ff8fb0', text: '+3 maximale Herzen, aber jeder Treffer kostet 2 Herzen.' },
  gier:     { name: 'Gierauge',       col: '#ffd45c', text: 'Doppelte Münzen, aber im Laden ist alles 30 % teurer.' },
  feder:    { name: 'Leichte Feder',  col: '#fff6d0', text: 'Murmel +20 % Tempo, Plattform 15 % schmaler.' },
  mond:     { name: 'Mondstein',      col: '#c8b8ff', text: 'Dein Schwung verfällt nie.' },
  sonne:    { name: 'Sonnenamulett',  col: '#ff9a3a', text: 'Alle Gegner erscheinen brennend.' },
  klee:     { name: 'Vierklee',       col: '#6fcf5f', text: 'Bei jeder Belohnung eine Power-up-Wahl mehr.' },
  schaedel: { name: 'Totenkopf',      col: '#fffcf0', text: '+50 % Schaden, aber du kannst nicht mehr heilen.' },
  echo:     { name: 'Echoring',       col: '#6fd0f0', text: 'Der Skill deiner Murmel löst doppelt aus.' },
  chaos:    { name: 'Chaoswürfel',    col: '#e84e5a', text: 'Sofort 2 zufällige Power-ups, aber −1 maximales Herz.' },
  schild:   { name: 'Dornenschild',   col: '#7fd6ef', text: 'Der erste Treffer in jedem Raum wird geblockt.' },
};
const rel = (k) => !!(G.run && G.run.rel && G.run.rel[k]);
function relCard(k, extra = {}) { const r = RELICS[k]; return { ...extra, color: r.col, html: uCard({ icon: `assets/relics/${k}.png`, color: r.col, title: r.name, tag: 'RELIKT', text: r.text }) }; }
function giveRelic(k) {
  const R = G.run; R.rel = R.rel || {}; R.rel[k] = true;
  if (k === 'glas') { R.maxHearts += 3; R.hearts += 3; }
  if (k === 'chaos') { R.maxHearts = Math.max(1, R.maxHearts - 1); R.hearts = Math.min(R.hearts, R.maxHearts); for (const p of rollPU(2, 'common')) applyPU(p); }
  sfx.play('win'); buzz(40); banner('RELIKT: ' + RELICS[k].name.toUpperCase(), 1.2); updateHud();
}
function relicChoice(head, then) {
  const own = G.run.rel || {}; const ks = shuffle(Object.keys(RELICS).filter((k) => !own[k])).slice(0, 2);
  if (!ks.length) return then();
  openDialog({ head, sub: 'Wähle ein Relikt – es bleibt den ganzen Run.', cards: ks.map((k) => relCard(k, { fn: () => { giveRelic(k); closeDialog(); then(); } })), buttons: [{ label: 'Keines', cls: 'gray', fn: () => { closeDialog(); then(); } }] });
}
function finishNode() {
  const R = G.run; if (R.pending) { R.pending.done = true; R.node = R.pending; } R.pending = null;
  if (R.node.type === 'boss') return R.chapter >= BIOMES.length - 1 ? victory() : nextChapter();
  showMap();
}

// ---------------------------------------------------------------- Raum
function setMode(m) {
  G.mode = m;
  $('title').classList.toggle('on', m === 'title');
  $('map').classList.toggle('on', m === 'map');
  mapCv.style.display = m === 'map' ? 'block' : 'none';
  $('hud').classList.toggle('on', m === 'play' || m === 'map');
  $('puBar').classList.toggle('on', m === 'play');
  world.visible = m === 'play';
  titleGroup.visible = m === 'title';
  if (m !== 'play') { $('hint').textContent = ''; $('momBar').style.display = 'none'; }
}

function clearRoom() {
  const Rm = G.room; if (!Rm) return;
  for (const e of Rm.enemies) killSprites(e);
  for (const b of Rm.balls) b.sp.remove();
  for (const s of Rm.shots) s.sp.remove();
  for (const c of Rm.coins) c.sp.remove();
  for (const d of Rm.drones) d.sp.remove();
  for (const o of [...Rm.hazards, ...Rm.saws, ...Rm.holes, ...Rm.bumpers]) o.sp.remove();
  if (Rm.beam) world.remove(Rm.beam);
  Rm.plat.sp.remove(); if (Rm.plat.twin) Rm.plat.twin.remove();
  G.room = null; clearParticles(); for (const n of nums) n.sp.remove(); nums.length = 0;
}
function killSprites(e) { e.sp.remove(); e.warn && e.warn.remove(); e.crown && e.crown.remove(); e.alert && e.alert.remove(); e.hb && (world.remove(e.hb[0]), world.remove(e.hb[1])); e.bubble && e.bubble.remove(); }

function startRoom(type, ev = null) {
  clearRoom(); buildBg(CH());
  const R = G.run, floor = R.floor;
  const P = PL(); const plat = { x: 90, tx: 90, w: Math.round((P.w + lvl('breit') * 8) * (rel('feder') ? 0.85 : 1)), bw: P.w, stun: 0, slow: 0, sp: new Sprite(`assets/plat/${P.id}.png`, P.w, 12, 3, { z: 16, parent: world }), twin: P.twin ? new Sprite(`assets/plat/${P.id}.png`, P.w, 12, 3, { z: 16, parent: world }) : null, squash: 0, blink: 0, gun: 0, blocks: 0 };
  G.room = { type, floor, enemies: [], balls: [], shots: [], coins: [], drones: [], plat, state: 'aim', t: 0, descendT: 0, combo: 0, hits: 0, kuppel: lvl('kuppel'), invuln: 0, clearT: 0, boss: null, aimA: -Math.PI / 2, aiming: false, march: { x: 0, dir: 1 }, mom: 0, momT: 0, hazards: [], echoes: [], saws: [], holes: [], bumpers: [], laserT: 2, rocketT: 2, stormT: 3, killC: 0, beam: null, waves: type === 'boss' || type === 'sonder' ? 0 : (floor >= 2 ? 1 : 0) + (floor >= 5 ? 1 : 0) + (CH() >= 3 && floor >= 7 ? 1 : 0), waveN: 0, ev, evT: ev ? EVENT_LEVELS[ev].time : 0, ink: 0, wind: 0, skillUses: 0, firstShot: true, enemyCap: 26 };
  const Rm = G.room;
  if (type === 'boss') spawnBoss();
  else if (type === 'sonder') genEvent(ev);
  else { genEnemies(floor, type === 'elite'); Rm.waveN = Rm.enemies.length; }
  spawnBall(true);
  if (G.run.g.mut === 'zwilling') { const m = spawnBall(false, 90, PLAT_Y - 20, 60, -150); m.life = 40; }
  Rm.wallC = 0; Rm.killS = 0;
  for (let i = 0; i < lvl('drohne'); i++) Rm.drones.push({ a: (i / Math.max(1, lvl('drohne'))) * Math.PI * 2, t: 1 + i * 0.7, sp: new Sprite('assets/misc/drone.png', 8, 8, 1, { z: 17, parent: world }) });
  for (let i = 0; i < lvl('flipper'); i++) Rm.bumpers.push({ x: 40 + rnd(0, 100), y: 125 + i * 30 + rnd(0, 10), r: 7, fl: 0, sp: new Sprite('assets/misc/bumper.png', 16, 16, 1, { z: 7, parent: world }) });
  const nSaw = lvl('saege') ? (syn('riesensaege') ? 2 : 1) : 0;
  for (let i = 0; i < nSaw; i++) Rm.saws.push({ a: i * Math.PI, sp: new Sprite('assets/misc/fx_saw0.png', 10, 10, 1, { z: 19, parent: world }) });
  setMode('play'); updateHud(); buildPuBar();
  banner(type === 'boss' ? BIO().bossName : type === 'sonder' ? EVENT_LEVELS[ev].name.toUpperCase() : type === 'elite' ? 'ELITE!' : `${CH() + 1}-${floor + 1}`, 1.1);
  if (type === 'boss' || type === 'sonder') { sfx.play('roar'); sfx.startMusic(CH(), true); }
  G.hint = R.rooms === 0 ? 'Wischen zum Zielen · loslassen = Schuss' : R.rooms === 1 ? 'Tippe, wenn die Murmel die Linie kreuzt!' : '';
}

function biomePool(floor) { const c = CH(); return ENEMY_KEYS.filter((k) => (ENEMIES[k].b ?? 0) === c && ENEMIES[k].from <= floor && ENEMIES[k].from < 99 && ENEMIES[k].biome !== -1); }
function genEnemies(floor, elite) {
  const pool = biomePool(floor);
  const basics = pool.filter((k) => ENEMIES[k].cost <= 2 && !ENEMIES[k].core && !ENEMIES[k].coins);
  let budget = 10 + floor * 2.6 + CH() * 3 + (elite ? 3 : 0);
  const list = [];
  while (budget > 0 && list.length < 26) {
    const k = Math.random() < 0.3 && basics.length ? pick(basics) : pick(pool);
    list.push(k); budget -= ENEMIES[k].cost;
  }
  const rows = Math.min(6, Math.max(2, Math.ceil(list.length / 7)));
  const form = pick(['rows', 'checker', 'v', 'block', 'two', 'ring']);
  let slots = [];
  for (let r = 0; r < 6; r++) for (let c = 0; c < COLS; c++) {
    let ok = true;
    if (form === 'checker') ok = (r + c) % 2 === 0;
    if (form === 'v') ok = Math.abs(c - 4.5) >= r * 0.8 - 0.5 && Math.abs(c - 4.5) <= r * 0.8 + 2.5;
    if (form === 'block') ok = c >= 2 && c <= 7;
    if (form === 'two') ok = c !== 4 && c !== 5;
    if (form === 'ring') ok = r === 0 || r === rows || c === 1 || c === 8 || (r > rows && c >= 3 && c <= 6);
    if (ok) slots.push({ r, c });
  }
  if (slots.length < list.length) for (let r = 0; r < 6; r++) for (let c = 0; c < COLS; c++) if (!slots.some((s) => s.r === r && s.c === c)) slots.push({ r, c });
  slots.sort((a, b) => a.r - b.r || Math.abs(a.c - 4.5) - Math.abs(b.c - 4.5));
  slots = slots.slice(0, list.length);
  // Schützen eher hinten (oben)
  list.sort((a, b) => (ENEMIES[b].shoot ? 1 : 0) - (ENEMIES[a].shoot ? 1 : 0));
  list.forEach((k, i) => addEnemy(k, COL_X(slots[i].c), ROW_Y(slots[i].r)));
  if (elite) {
    const cands = G.room.enemies.filter((e) => !e.def.core && !e.def.coins && !e.def.dive && e.def.cost >= 2);
    const e = cands.length ? pick(cands) : G.room.enemies[0];
    makeElite(e);
  }
}
function spawnWave() {
  const Rm = G.room; Rm.waves--;
  for (const e of Rm.enemies) e.hy += 10;
  const before = Rm.enemies.length;
  const pool = biomePool(Rm.floor);
  let budget = 4 + Rm.floor * 1.2 + CH() * 1.5;
  const cols = shuffle([...Array(COLS).keys()]);
  let i = 0;
  while (budget > 0 && i < 14) {
    const k = pick(pool); budget -= ENEMIES[k].cost;
    const c = cols[i % COLS], r = Math.floor(i / COLS);
    const e = addEnemy(k, COL_X(c), ROW_Y(r) - 70 - r * 6); e.hx = COL_X(c) - Rm.march.x; e.hy = ROW_Y(r); i++;
  }
  Rm.waveN = Rm.enemies.length - before + Math.floor(before / 2);
  banner('NEUE WELLE!', 0.9); sfx.play('roar'); G.shake = 0.2;
}
const AFFIX = { schnell: 'Flinker', gepanzert: 'Gepanzerter', heilend: 'Heilender', spaltend: 'Spaltender', wuetend: 'Wütender' };
function makeElite(e) {
  e.elite = true; e.max = e.hp = Math.round(e.hp * 3 + 4); e.atkMul = 0.65;
  e.affix = pick(Object.keys(AFFIX)); setTimeout(() => G.room && banner(`${AFFIX[e.affix]} ${e.def.name}`.toUpperCase(), 1), 900);
  if (e.affix === 'schnell') e.atkMul = 0.45; if (e.affix === 'wuetend' && !e.def.shoot) e.def = { ...e.def, shoot: { every: 4, kind: 'seed' } };
  e.crown = new Sprite('assets/misc/crown.png', 9, 7, 1, { z: 9, parent: world });
}

function addEnemy(k, x, y) {
  const def = ENEMIES[k];
  const e = { k, def, x, y, hx: x, hy: y, by: y, ox: 0, oy: 0, hp: Math.max(1, Math.round((def.hp * (1 + CH() * 0.5) + G.run.floor / 3) * (rel('zorn') ? 0.7 : 1))), max: 0, r: 7, t: rnd(0, 3), fl: 0, burn: 0, poison: 0, slow: 0, bubble: null, ghost: false, atk: rnd(1.5, 3.5), state: 'idle', atkMul: Math.max(0.6, 1.3 - G.run.floor * 0.025 - CH() * 0.1), hitCd: 0, dead: false, seed: (Math.random() * 6) | 0, awake: !def.mimic, telegraph: 0 };
  if (k === 'moosmumpf') e.r = 8;
  e.max = e.hp; if (rel('sonne')) e.burn = 4;
  e.sp = new Sprite(`assets/enemies/${k}.png`, 16, 16, 4, { z: 8, parent: world });
  G.room.enemies.push(e);
  return e;
}

function spawnBoss() {
  const e = addEnemy('huepfer', 90, 70);
  const B = BIO();
  e.sp.remove(); e.sp = new Sprite(`assets/enemies/${B.boss}.png`, 32, 32, 2, { z: 8, parent: world });
  e.k = B.boss; e.def = { name: B.bossName, hp: B.bossHp }; e.boss = true; e.r = 14; e.max = e.hp = B.bossHp; e.atk = 2.5; e.phase = 0; e.move = 0;
  G.room.boss = e;
  const mk = biomePool(0)[0]; addEnemy(mk, 40, 120); addEnemy(mk, 140, 120);
}

function spawnBall(main, x, y, vx = 0, vy = 0) {
  const Rm = G.room, g = G.run.g;
  const b = { main, x: x ?? Rm.plat.x, y: y ?? PLAT_Y - 7, vx, vy, r: main ? 6 + lvl('riese') : 3, caught: main, pierce: 0, ram: 0, charge: 0, boost: 0, life: main ? 0 : 9, t: 0, hitAnim: 0, skillAnim: 0 };
  b.sp = main ? new Sprite(gTex(g), 16, 16, 14, { z: 18, parent: world }) : new Sprite(miniFor(g.col), 8, 8, 1, { z: 18, parent: world });
  if (main) { const big = g.mut === 'riesig' ? 1 : 0; b.r += big; const s = 1 + (lvl('riese') + big) * 0.17; b.sp.sx = b.sp.sy = s; }
  Rm.balls.push(b);
  return b;
}
const mainBall = () => G.room.balls.find((b) => b.main);

// Event-Level
function genEvent(ev) {
  const Rm = G.room, B = BIO(), pool = biomePool(Rm.floor);
  const place = (k, c, r) => addEnemy(k, COL_X(c), ROW_Y(r));
  if (ev === 'muenzregen') { Rm.noAttack = true; for (let r = 0; r < 3; r++) for (let c = 0; c < COLS; c += 1 + (r % 2)) place(pick([B.coin, 'taler']), c, r); }
  if (ev === 'bombenkette') { for (let r = 0; r < 5; r++) for (let c = 0; c < COLS; c++) { const bomb = (r + c) % 3 === 0; const e = place(bomb ? (ENEMIES[B.bomb] ? B.bomb : 'ploepp') : pick(pool.filter((k) => ENEMIES[k].cost <= 2 && !ENEMIES[k].split)), c, r); e.hp = e.max = 1; if (bomb) e.def = { ...e.def, explode: 2 }; else e.def = { ...e.def, explode: 0 }; } Rm.noAttack = true; }
  if (ev === 'ansturm') { genEnemies(Rm.floor, false); Rm.surge = 3; }
  if (ev === 'kernjagd') { const sl = shuffle([...Array(30).keys()]); for (let i = 0; i < 18; i++) { const k = i < 3 ? B.core : pick(pool.filter((k) => !ENEMIES[k].core)); place(k, sl[i] % COLS, Math.floor(sl[i] / COLS)).target = i < 3; } }
}

// ---------------------------------------------------------------- Werte
function speedOf(b) { return (rel('feder') ? 1.2 : 1) * (rel('sanduhr') ? 0.9 : 1) * (PL().speed || 1) * (G.room ? (1 + Math.min(0.4, G.room.t * 0.005)) * (1 + 0.13 * G.room.mom) : 1) * BASE_SPEED * G.run.m.speed * (1 + 0.12 * lvl('leicht')) * (1 - 0.06 * lvl('schwer')) * (b.boost > 0 ? 1.3 : 1) * (b.main ? 1 : 0.95); }
function baseDmg() { let d = (G.run.m.dmg + lvl('schwer') + lvl('riese') * 0.5 + lvl('wackelplatte')) * (rel('schaedel') ? 1.5 : 1); if (lvl('glaskanone')) d *= 2; if (G.room) d *= 1 + 0.08 * G.room.mom; d *= PL().dmg || 1; return d; }

// ---------------------------------------------------------------- Schaden
function hitEnemy(e, b, dmg, src = 'ball') {
  if (e.dead) return;
  const Rm = G.room;
  if (!e.awake) { e.awake = true; e.sp.setFrame(1); sfx.play('roar'); banner('Ein Truhenbeisser!', 0.8); }
  if (e.bubble && src !== 'dot') { e.bubble.remove(); e.bubble = null; sfx.play('armor'); emit(e.x, e.y, '#7fd6ef', 8, 40); e.fl = 0.6; return; }
  if (e.def.clam && !e.open && src !== 'dot') { sfx.play('armor'); emit(e.x, e.y, '#c08bff', 4, 30); e.fl = 0.3; return; }
  if (e.def.inflate && e.puffT > 0 && src !== 'dot') { sfx.play('armor'); e.fl = 0.3; return; }
  if (e.def.shield === 'bottom' && b && b.vy < 0 && b.y > e.y + 2 && !b.ram) { sfx.play('armor'); emit(e.x, e.y + 6, '#c9cbd6', 5, 30); e.fl = 0.3; return; }
  if (e.def.armor && src !== 'dot') dmg = Math.min(dmg, e.def.armor + (e.elite ? 1 : 0) + (elF('metall') ? 1 : 0));
  if (e.affix === 'gepanzert' && src !== 'dot') dmg = Math.min(dmg, 2);
  let crit = false;
  if ((e.elite || e.boss) && lvl('kopfgeld')) { dmg *= 1 + 0.25 * lvl('kopfgeld'); fx('kopfgeld'); }
  if (src === 'ball' && lvl('raserei')) { dmg *= 1 + Math.min(1, Rm.combo * 0.1); fx('raserei'); }
  if ((src === 'ball' && Math.random() < lvl('krit') * 0.15 + elF('licht') * 0.12) && lvl('krit')) fx('krit');
  if ((src === 'ball' && Math.random() < lvl('krit') * 0.15 + elF('licht') * 0.12) || (src === 'echo' && syn('resonanz'))) { dmg *= 2; crit = true; }
  e.hp -= dmg; e.fl = 1; e.sq = 0.14;
  if (e.def.inflate) e.puffT = 1.6;
  if (e.def.mirror && src !== 'mirror') for (const o of Rm.enemies) if (o !== e && !o.dead && o.def.mirror) { ring(o.x, o.y, '#c8b8ff'); hitEnemy(o, null, dmg, 'mirror'); }
  if (src !== 'dot' || dmg >= 1) dmgNum(e.x, e.y - 8, dmg, crit);
  if (src !== 'dot') {
    emit(e.x, e.y, crit ? '#ffd45c' : '#fffcf0', crit ? 10 : 5, crit ? 60 : 40);
    sfx.play(crit ? 'perfect' : 'hit', 0.9 + Math.min(Rm.combo, 10) * 0.05);
  }
  if (src === 'ball' && b) {
    if (lvl('feuer')) { e.burn = 3; fx('feuer'); }
    if (b && b.lava > 0) e.burn = Math.max(e.burn, 3);
    if (lvl('gift')) { e.poison = Math.min(10, e.poison + lvl('gift')); fx('gift'); }
    if (lvl('frost')) { e.slow = 1.5 + lvl('frost'); fx('frost'); }
    if (lvl('blitz')) { chain(e, lvl('blitz')); fx('blitz'); }
    // Element der Murmel
    if (elF('feuer')) e.burn = Math.max(e.burn, 3 * elF('feuer'));
    if (elF('gift')) e.poison = Math.min(10, e.poison + elF('gift'));
    if (elF('eis')) e.slow = Math.max(e.slow, 1.2 + elF('eis'));
    if (elF('blitz') && Math.random() < elF('blitz')) chain(e, 1);
    if (elF('wasser')) { for (const o of Rm.enemies) if (o !== e && !o.dead && dist(o.x, o.y, e.x, e.y) < 22) hitEnemy(o, null, 0.5 * elF('wasser'), 'chain'); emit(e.x, e.y, '#4fb4e8', 5, 40); }
    Rm.hits++;
    if (lvl('echo') && Rm.hits % 3 === 0 && fx('echo')) Rm.echoes.push({ e, dmg, t: 0.22 });
    if (lvl('splitter') && Rm.hits % (6 - lvl('splitter')) === 0 && Rm.balls.length < 8) {
      const a = Math.atan2(b.vy, b.vx) + rnd(-0.8, 0.8); spawnBall(false, b.x, b.y, Math.cos(a) * 140, Math.sin(a) * 140); fx('splitter');
    }
    if (e.def.spikes) { e.spike = 0.25; }
  }
  if (e.hp <= 0) killEnemy(e, b);
}
function chain(from, n) {
  const Rm = G.room; let cur = from; const done = new Set([from]);
  for (let i = 0; i < n; i++) {
    const t = Rm.enemies.filter((o) => !o.dead && !done.has(o) && !o.ghost && dist(o.x, o.y, cur.x, cur.y) < 56).sort((a, b) => dist(a.x, a.y, cur.x, cur.y) - dist(b.x, b.y, cur.x, cur.y))[0];
    if (!t) break;
    const steps = 6; for (let s = 1; s < steps; s++) emit(cur.x + (t.x - cur.x) * s / steps, cur.y + (t.y - cur.y) * s / steps, '#ffe14d', 1, 6, 1, 0.2, { g: 0 });
    done.add(t); sfx.play('zap'); hitEnemy(t, null, syn('supraleiter') ? 2 : 1, 'chain'); cur = t;
  }
}
function killEnemy(e, b) {
  if (e.dead) return;
  const Rm = G.room, R = G.run; e.dead = true;
  if (e.boss) { G.run.cores++; G.run.eggs++; bossDeath(e); return; }
  R.kills++; Rm.combo++; buzz(e.elite ? 30 : 8); if (++Rm.killS % 4 === 0) setTimeout(() => G.room === Rm && autoSkill('abschuss'), 0);
  if (e.elite && Math.random() < 0.3 + 0.15 * ws('kern')) { R.cores++; banner('FUSIONSKERN!', 0.8); sfx.play('pickup'); } G.hitstop = Math.max(G.hitstop, e.elite ? 0.09 : 0.03); G.shake = Math.max(G.shake, e.elite ? 0.25 : 0.06);
  ring(e.x, e.y, '#fffcf0');
  emit(e.x, e.y, '#fffcf0', 10, 60, 2); emit(e.x, e.y, '#ff8fa8', 6, 50, 1);
  sfx.play('pop', 0.9 + Math.min(Rm.combo, 12) * 0.06);
  const n = (e.def.coins || (Math.random() < 0.55 ? 1 : 0)) + (e.elite ? 8 : 0);
  for (let i = 0; i < n; i++) dropCoin(e.x, e.y);
  if ((e.elite && Math.random() < 0.6) || (e.def.mimic && Math.random() < 0.5) || Math.random() < 0.025) dropHeart(e.x, e.y);
  if (e.def.split) for (let i = 0; i < (e.def.splitN || 2); i++) { const dx = (i - ((e.def.splitN || 2) - 1) / 2) * 8; const m = addEnemy(e.def.split, e.x + dx, e.y); m.hy = e.hy; m.by = e.by; m.hx = clamp(e.hx + dx, 16, 164); }
  if (e.affix === 'spaltend') for (const dx of [-8, 8]) { const m = addEnemy(e.k, e.x + dx, e.y); m.hy = e.hy; m.by = e.by; m.hx = clamp(e.hx + dx, 16, 164); m.hp = m.max = Math.ceil(m.max / 2); }
  if (e.def.balloon) for (let i = 0; i < 8; i++) emit(e.x, e.y, pick(['#ff7182', '#ffd45c', '#6fd0f0', '#8fd16a']), 1, 60, 1, 0.6);
  if (e.def.explode) boom(e.x, e.y, 22, e.def.explode, e);
  if (e.def.core) { banner('KERN ZERBROCHEN!', 0.7); for (const o of Rm.enemies) if (!o.dead && o !== e) hitEnemy(o, null, e.def.core, 'chain'); }
  if (lvl('explosiv')) { boom(e.x, e.y, 16 + lvl('explosiv') * 4, lvl('explosiv'), e); fx('explosiv'); }
  if (syn('giftbrand') && e.burn > 0 && e.poison > 0) { boom(e.x, e.y, 20, 2, e); emit(e.x, e.y, '#7ad35a', 14, 60, 2); }
  if (lvl('midas') && Math.random() < 0.1 * lvl('midas')) { for (let i = 0; i < 6; i++) dropCoin(e.x, e.y); emit(e.x, e.y, '#ffd45c', 16, 70, 2); sfx.play('coin'); fx('midas'); }
  Rm.killC++;
  if (lvl('schwarzloch') && Rm.killC % 12 === 0) spawnHole(e.x, e.y);
  if (lvl('erdbeben') && Rm.killC % (lvl('erdbeben') === 2 ? 7 : 10) === 0) quake();
  if (b && lvl('bohrer')) { b.pierce = Math.max(b.pierce, lvl('bohrer')); fx('bohrer'); }
  if (lvl('vampir')) { R.vampKills++; if (R.vampKills >= 15 / lvl('vampir')) { R.vampKills = 0; heal(1); fx('vampir'); } }
  if (lvl('komboheiler') && Rm.combo === 8) { heal(1); fx('komboheiler'); }
  if (Rm.combo >= 3) comboText(Rm.combo);
  killSprites(e);
}
function ring(x, y, col) { for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; emit(x + Math.cos(a) * 3, y + Math.sin(a) * 3, col, 1, 70, 1, 0.25, { angle: a, spread: 0.1, g: 0, up: 0, drag: 5 }); } }
// Schadenszahlen (Pixel-Ziffern)
const DIG = { '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '011', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'], '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'], '!': ['1', '1', '1', '0', '1'] };
const numTexCache = new Map(); const nums = [];
function numTex(txt, col) {
  const key = txt + col; if (numTexCache.has(key)) return numTexCache.get(key);
  const w = txt.length * 4 + 1, c = document.createElement('canvas'); c.width = w; c.height = 7; const g = c.getContext('2d');
  [...txt].forEach((ch, i) => DIG[ch].forEach((row, y) => [...row].forEach((v, x) => { if (v === '1') { g.fillStyle = '#2b1d3a'; g.fillRect(i * 4 + x, y, 3, 3); } })));
  [...txt].forEach((ch, i) => DIG[ch].forEach((row, y) => [...row].forEach((v, x) => { if (v === '1') { g.fillStyle = col; g.fillRect(i * 4 + x + 1, y + 1, 1, 1); } })));
  const t = { tex: canvasTex(c), w }; numTexCache.set(key, t); return t;
}
function dmgNum(x, y, d, crit) {
  if (nums.length > 24) { const o = nums.shift(); o.sp.remove(); }
  const txt = String(Math.max(1, Math.round(d))) + (crit ? '!' : '');
  const t = numTex(txt, crit ? '#ffd45c' : '#fffcf0');
  const sp = new Sprite(t.tex, t.w, 7, 1, { z: 35, parent: world });
  nums.push({ sp, x: x + rnd(-3, 3), y, t: 0 });
}
function updateNums(dt) {
  for (const n of nums) { n.t += dt; n.y -= (n.t < 0.15 ? 60 : 12) * dt; n.sp.opacity = n.t > 0.45 ? 1 - (n.t - 0.45) / 0.2 : 1; n.sp.at(n.x, n.y); }
  for (let i = nums.length - 1; i >= 0; i--) if (nums[i].t > 0.65) { nums[i].sp.remove(); nums.splice(i, 1); }
}
function boom(x, y, r, dmg, src) {
  emit(x, y, '#ffd45c', 14, 70, 2, 0.4); emit(x, y, '#ff7a2a', 10, 50, 2, 0.5); sfx.play('boom'); G.shake = Math.max(G.shake, 0.18);
  for (const o of G.room.enemies) if (!o.dead && o !== src && dist(o.x, o.y, x, y) < r + o.r) { if (syn('napalm')) o.burn = 3; hitEnemy(o, null, dmg, 'chain'); }
}
function bossDeath(e) {
  buzz([80, 40, 160]);
  const Rm = G.room; killSprites(e); sfx.play('boom'); G.shake = 0.6;
  for (let i = 0; i < 6; i++) setTimeout(() => G.room && emit(e.x + rnd(-14, 14), e.y + rnd(-14, 14), pick(['#ffd45c', '#c9955f', '#5fbf5f']), 18, 90, 2, 0.7), i * 120);
  for (const o of Rm.enemies) if (!o.dead) { o.dead = true; killSprites(o); emit(o.x, o.y, '#fffcf0', 8, 50); }
  for (let i = 0; i < 20; i++) dropCoin(e.x + rnd(-10, 10), e.y);
}
function dropCoin(x, y, heart = false) {
  const a = rnd(0, Math.PI * 2), sp = rnd(30, 70);
  const c = { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, heart, t: 0, tx: heart ? 14 : 134, ty: 8, sp: new Sprite(heart ? 'assets/misc/heart.png' : 'assets/misc/coin.png', heart ? 9 : 8, 8, 1, { z: 45, parent: world }) };
  G.room.coins.push(c);
}
const dropHeart = (x, y) => dropCoin(x, y, true);
function heal(n) { if (rel('schaedel')) return; const R = G.run; const h = R.hearts; R.hearts = Math.min(R.maxHearts, R.hearts + n); if (R.hearts > h) { sfx.play('pickup'); G.room && emit(G.room.plat.x, PLAT_Y, '#ff5a6e', 8, 40); } updateHud(); }
function hurt(n = 1, why = '') {
  const Rm = G.room, R = G.run;
  if (Rm.invuln > 0 || Rm.state === 'clear' || Rm.state === 'dead') return;
  if (rel('schild') && !Rm.relBlock) { Rm.relBlock = true; Rm.invuln = 0.8; emit(Rm.plat.x, PLAT_Y - 4, '#7fd6ef', 16, 60, 2); sfx.play('armor'); banner('GEBLOCKT!', 0.5); return; }
  if (rel('glas')) n *= 2;
  R.hearts -= n; Rm.invuln = 1.0; buzz([45, 35, 60]); (G.dmgLog = G.dmgLog || {})[why || 'other'] = (G.dmgLog[why || 'other'] || 0) + 1; G.shake = 0.3; sfx.play('lose');
  emit(Rm.plat.x, PLAT_Y, '#ff5a6e', 12, 60, 2);
  updateHud();
  if (R.hearts <= 0) { Rm.state = 'dead'; Rm.deadT = 0.9; }
}

// ---------------------------------------------------------------- Geschosse
function shoot(x, y, kind, vx, vy, enemy = true, dmg = 1, target = null) {
  const img = { seed: 'p_seed', spread: 'p_seed', spike: 'fx_spike', slime: 'p_slime', ice: 'p_ice', rock: 'p_rock', pellet: 'p_pellet', spark: 'p_spark', rocket: 'fx_rocket', star: 'fx_star', thorn: 'p_spark', zap: 'p_spark', ink: 'p_slime', spiral: 'p_pellet', bubble: 'p_ice', shard: 'p_ice' }[kind];
  if (enemy && kind !== 'rock') { const f = rel('sanduhr') ? 0.6 : 0.8; vx *= f; vy *= f; }
  const sz = img.startsWith('fx_') ? 7 : 6;
  const red = enemy && kind !== 'rock';
  const s = { x, y, vx, vy, kind, enemy, dmg, target, t: 0, red, sp: red ? new Sprite('assets/misc/e_shot.png', 8, 8, 2, { z: 14, parent: world }) : new Sprite(`assets/misc/${img}.png`, sz, sz, 1, { z: 14, parent: world }) };
  if (!red) { if (kind === 'ink') s.sp.tint('#6a4a9a'); if (kind === 'spiral') s.sp.tint('#ff86c8'); if (kind === 'zap') s.sp.tint('#fff27a'); }
  G.room.shots.push(s); return s;
}
function aimAtPlatform(e, speed, spreadA = 0) {
  const p = G.room.plat; const a = Math.atan2(PLAT_Y - e.y, p.x + rnd(-6, 6) - e.x) + spreadA;
  return [Math.cos(a) * speed, Math.sin(a) * speed];
}
function initPats(e, k) {
  const pool = ['aim', 'lead', 'fan', 'lob', ...(CH() >= 1 ? ['burst', 'wave', 'wall', 'bank'] : []), ...(CH() >= 2 ? ['hold', 'cross'] : []), ...(e.elite ? ['ring', 'burst', 'wall'] : [])];
  e.pats = shuffle(pool.slice()).slice(0, e.elite ? 3 : 2); if (k === 'spread') e.pats[0] = 'fan';
}
function choosePat(e) { if (!e.pats) initPats(e, e.def.shoot && e.def.shoot.kind); return Math.random() < 0.2 ? 'aim' : pick(e.pats); }
function warnFx(e) {
  if (!e.warn) e.warn = new Sprite('assets/ui/i_warn.png', 16, 16, 1, { z: 30, parent: world });
  e.warn.sx = e.warn.sy = 0.5; e.warn.visible = Math.floor(G.t * 8) % 2 === 0; e.warn.at(e.x, e.y - 12);
  const p = G.room.plat, pat = e.nextPat; if (Math.random() > 0.5) return;
  if (pat === 'wall') for (let i = 0; i < 5; i++) emit(clamp(p.x + (i - 2) * 14, WALL + 4, LW - WALL - 4), TOP + 3, '#ff2a3a', 1, 2, 1, 0.12, { g: 0 });
  else if (pat === 'lob') { const a = G.t * 6; emit(p.x + Math.cos(a) * 8, PLAT_Y - 8 + Math.sin(a) * 3, '#ff2a3a', 1, 2, 1, 0.18, { g: 0 }); }
  else if (pat === 'bank' || pat === 'cross') emit(p.x < LW / 2 || pat === 'cross' ? LW - WALL - 3 : WALL + 3, rnd(e.y, PLAT_Y - 40), '#ff2a3a', 1, 2, 1, 0.15, { g: 0 });
  else if (pat === 'ring' || pat === 'hold') emit(e.x + rnd(-9, 9), e.y + rnd(-9, 9), '#ff2a3a', 1, 6, 1, 0.2, { g: 0 });
  else { const k2 = Math.random(); emit(e.x + (p.x - e.x) * k2 * 0.4, e.y + (PLAT_Y - e.y) * k2 * 0.4, '#ff2a3a', 1, 2, 1, 0.12, { g: 0 }); }
}
function shotPattern(e, pat, kind, sp) {
  const Rm = G.room, p = Rm.plat, x0 = e.x, y0 = e.y + 5;
  const aimX = (x, off = 0) => { const a = Math.atan2(PLAT_Y - y0, x + off - x0); return [Math.cos(a) * sp, Math.sin(a) * sp]; };
  const later = (ms, f) => setTimeout(() => { if (G.room === Rm && !e.dead && Rm.state !== 'clear') f(); }, ms);
  if (pat === 'aim') { const [vx, vy] = aimX(p.x, rnd(-10, 10)); shoot(x0, y0, kind, vx, vy); }
  if (pat === 'lead') { const [vx, vy] = aimX(p.tx ?? p.x, (p.tx - p.x) * 0.6 || rnd(-14, 14)); shoot(x0, y0, kind, vx, vy); }
  if (pat === 'fan') { const n = e.elite ? 5 : 3; for (let i = 0; i < n; i++) { const a = Math.atan2(PLAT_Y - y0, p.x - x0) + (i - (n - 1) / 2) * 0.3; shoot(x0, y0, kind, Math.cos(a) * sp * 0.85, Math.sin(a) * sp * 0.85); } }
  if (pat === 'burst') for (let i = 0; i < 3; i++) later(i * 170, () => { const [vx, vy] = aimX(G.room.plat.x, rnd(-4, 4)); shoot(e.x, e.y + 5, kind, vx * 1.05, vy * 1.05); });
  if (pat === 'lob') { const T = rnd(1.5, 1.9), g = 70, tx = p.x + rnd(-6, 6); const s2 = shoot(x0, y0, kind, 0, 0); s2.vx = (tx - x0) / T; s2.vy = (PLAT_Y - y0 - 0.5 * g * T * T) / T; s2.g = g; }
  if (pat === 'wave') { const [vx, vy] = aimX(p.x); const s2 = shoot(x0, y0, kind, vx * 0.8, vy * 0.8); s2.wave = rnd(28, 40); s2.wf = rnd(5, 7); }
  if (pat === 'wall') { const gap = (Math.random() * 4) | 0; for (let i = 0; i < 5; i++) if (i !== gap) { const xx = clamp(p.x + (i - 2) * 14, WALL + 4, LW - WALL - 4); later(i * 60, () => shoot(xx, TOP + 4, kind, 0, sp * 0.75)); } emit(x0, y0, '#fffcf0', 6, 30); }
  if (pat === 'bank') { const side = p.x < LW / 2 ? 1 : -1; const s2 = shoot(x0, y0, kind, side * sp * 0.75, sp * 0.62); s2.bounce = 2; }
  if (pat === 'hold') { const s2 = shoot(x0, y0, kind, rnd(-20, 20), 10); s2.hold = rnd(0.7, 1); s2.hsp = sp * 1.35; }
  if (pat === 'cross') for (const d of [-1, 1]) { const s2 = shoot(x0, y0, kind, d * sp * 0.7, sp * 0.6); s2.bounce = 1; }
  if (pat === 'ring') { const n = 8, o = rnd(0, 1); for (let i = 0; i < n; i++) { const a = o + i / n * Math.PI * 2; shoot(x0, y0, kind, Math.cos(a) * sp * 0.6, Math.abs(Math.sin(a)) * sp * 0.6 + 12); } }
}
function enemyAttack(e) {
  if (G.room.noAttack) return;
  const k = e.def.shoot ? e.def.shoot.kind : null;
  if (e.def.mimic && !e.def.shoot) { const [vx, vy] = aimAtPlatform(e, 75); shoot(e.x, e.y + 4, 'seed', vx, vy); sfx.play('launch'); return; }
  const SPD = { seed: 70, spread: 62, slime: 55, ice: 65, zap: 80, ink: 55, fast: 100 };
  if (SPD[k]) {
    const kind = k === 'fast' ? 'seed' : k, sp = SPD[k] * rnd(0.9, 1.12) * (CH() === 0 ? 0.88 : 1);
    if (!e.pats) initPats(e, k);
    shotPattern(e, e.nextPat || choosePat(e), kind, sp); e.nextPat = null; if (e.warn) e.warn.visible = false;
  }
  if (k === 'spiral') { e.spin = (e.spin || 0) + 0.6; for (let i = 0; i < (e.elite ? 6 : 4); i++) { const a = e.spin + i * Math.PI * 2 / (e.elite ? 6 : 4); if (Math.sin(a) > -0.2) shoot(e.x, e.y, 'spiral', Math.cos(a) * 55, Math.abs(Math.sin(a)) * 55 + 15); } }
  sfx.play('launch', 1.4);
}

// ---------------------------------------------------------------- Update
function update(dt) {
  const Rm = G.room, R = G.run; if (!Rm) return;
  Rm.t += dt; Rm.invuln -= dt; Rm.ghostT = (Rm.ghostT || 0) - dt;
  Rm.momT += dt; if (!rel('mond') && Rm.momT > 2.4 && Rm.mom > 0) Rm.mom = Math.max(0, Rm.mom - dt * 0.9);
  const plat = Rm.plat;
  // --- Plattform
  plat.stun -= dt; plat.slow -= dt;
  let moveK = 0;
  if (G.keys.ArrowLeft || G.keys.a) moveK -= 1; if (G.keys.ArrowRight || G.keys.d) moveK += 1;
  const ball = mainBall();
  if (moveK && !(ball && ball.caught && G.keys.aimMode)) plat.tx += moveK * 170 * dt;
  if (G.auto) botControl(dt);
  const half = plat.w / 2;
  plat.tx = clamp(plat.tx, WALL + half, LW - WALL - half);
  if (plat.stun > 0) plat.tx = plat.x;
  const sp = plat.slow > 0 ? 0.45 : 1;
  if (lvl('wackelplatte') || PL().slide) plat.x += (plat.tx - plat.x) * Math.min(1, dt * (PL().slide ? 4 : 6) * sp);
  else plat.x += clamp(plat.tx - plat.x, -400 * sp * dt, 400 * sp * dt);
  plat.squash -= dt; plat.blink -= dt;
  plat.sp.setFrame(plat.squash > 0 ? 2 : (Rm.t % 3.2 < 0.15 ? 1 : 0)); plat.sp.sx = plat.w / plat.bw;
  plat.sp.tint(plat.stun > 0 ? '#bfefff' : plat.slow > 0 ? '#b6f08a' : '#ffffff');
  plat.sp.opacity = Rm.invuln > 0 && (Rm.t * 12) % 2 < 1 ? 0.5 : 1;
  if (PL().wobble) plat.x += Math.sin(Rm.t * 9) * 0.9;
  plat.sp.at(plat.x, PLAT_Y + 4);
  if (plat.twin) { plat.twin.sx = plat.sp.sx; plat.twin.setFrame(plat.sp.frame); plat.twin.tint(plat.stun > 0 ? '#bfefff' : '#ffffff'); plat.twin.at(LW - plat.x, PLAT_Y + 4); }
  // Plattformkanone
  if (PL().gun && Rm.state !== 'clear') { plat.pg = (plat.pg || 0) - dt; if (plat.pg <= 0) { plat.pg = PL().gun; shoot(plat.x, PLAT_Y - 6, 'pellet', 0, -180, false, 1); } }
  if (lvl('kanone') && Rm.state === 'fly' || lvl('kanone') && Rm.state === 'aim') {
    plat.gun -= dt; if (plat.gun <= 0) { plat.gun = (2.6 - lvl('kanone') * 0.55) / (syn('feuerkraft') ? 2 : 1); fx('kanone'); shoot(plat.x, PLAT_Y - 4, 'pellet', 0, -170, false, 1); sfx.play('ui'); }
  }
  // Drohnen
  for (const d of Rm.drones) {
    d.a += dt * 2; d.t -= dt;
    const dx = plat.x + Math.cos(d.a) * 26, dy = PLAT_Y - 26 + Math.sin(d.a) * 8; d.sp.at(dx, dy);
    if (d.t <= 0) { d.t = syn('feuerkraft') ? 1.1 : 2.2; const tg = nearestEnemy(dx, dy); if (tg) { fx('drohne'); const a = Math.atan2(tg.y - dy, tg.x - dx); shoot(dx, dy, 'pellet', Math.cos(a) * 160, Math.sin(a) * 160, false, 1); } }
  }

  // --- Murmeln
  for (const b of [...Rm.balls]) updateBall(b, dt);

  // --- Gegner
  const slowMul = 1 - 0.1 * lvl('zeitlupe');
  Rm.descendT += dt * slowMul;
  const descEvery = Math.max(6.5, 15 - Rm.floor * 0.9 - CH() * 0.6);
  if (Rm.descendT > descEvery && !Rm.boss && Rm.state !== 'clear') { Rm.descendT = 0; for (const e of Rm.enemies) e.hy += 8; sfx.play('stun'); }
  // Formation marschiert hin und her
  if (!Rm.boss) {
    const live = Rm.enemies.filter((e) => !e.dead && !e.noMarch);
    if (live.length) {
      const minX = Math.min(...live.map((e) => e.hx)), maxX = Math.max(...live.map((e) => e.hx));
      const sp = (4 + Rm.floor * 0.9 + CH() * 1.2) * (1 - 0.1 * lvl('zeitlupe'));
      Rm.march.x += Rm.march.dir * sp * dt;
      if (minX + Rm.march.x < WALL + 9) { Rm.march.x = WALL + 9 - minX; Rm.march.dir = 1; }
      if (maxX + Rm.march.x > LW - WALL - 9) { Rm.march.x = LW - WALL - 9 - maxX; Rm.march.dir = -1; }
    }
    // Neue Welle, wenn nur noch wenige übrig sind
    if (Rm.waves > 0 && Rm.state !== 'clear' && Rm.state !== 'dead' && live.length <= Math.max(1, Math.floor(Rm.waveN * 0.25))) spawnWave();
  }
  let dangerNear = false;
  for (const e of Rm.enemies) {
    if (e.dead) continue;
    updateEnemy(e, dt);
    if (e.y > DANGER - 24) dangerNear = true;
    if (e.y >= DANGER && !e.boss && e.state !== 'dive' && e.state !== 'swoop') {
      e.dead = true; killSprites(e); emit(e.x, e.y, '#ff5a6e', 12, 60, 2); sfx.play('boom'); hurt(1, 'line'); banner('DURCHGEBROCHEN!', 0.6);
    }
  }
  Rm.enemies = Rm.enemies.filter((e) => !e.dead);
  const mb = mainBall(); const coming = mb && !mb.caught && mb.vy > 0 && !mb.parried && mb.y > DANGER - 46 && mb.y < DANGER + parryWin(mb);
  if (!save.tut && G.run.rooms === 0 && !G.auto) tutTick(mb, Rm);
  Rm.lineFlash = Math.max(0, (Rm.lineFlash || 0) - dt);
  dangerDots.forEach((d, i) => {
    if (Rm.lineFlash > 0) { d.material.color.set('#ffd45c'); d.material.opacity = 1; }
    else if (coming) { d.material.color.set('#fffcf0'); d.material.opacity = Math.abs(mb.y - DANGER) < parryWin(mb) ? 1 : 0.55; }
    else { d.material.color.set('#ff5a6e'); d.material.opacity = dangerNear ? ((Rm.t * 4 + i * 0.2) % 2 < 1 ? 0.9 : 0.3) : 0.25; }
  });

  // --- Geschosse
  const pm = 1 - 0.25 * lvl('zeitlupe');
  for (const s of Rm.shots) {
    s.t += dt;
    if (s.target && !s.target.dead) { const a = Math.atan2(s.target.y - s.y, s.target.x - s.x), v = 150; s.vx += (Math.cos(a) * v - s.vx) * dt * 6; s.vy += (Math.sin(a) * v - s.vy) * dt * 6; }
    const m = s.enemy ? pm : 1;
    s.x += s.vx * dt * m; s.y += s.vy * dt * m;
    if (s.kind === 'rock') s.vy += 120 * dt;
    if (s.g) s.vy += s.g * dt;
    if (s.wave) s.x += Math.cos(s.t * s.wf) * s.wave * dt;
    if (s.bounce && (s.x < WALL + 3 || s.x > LW - WALL - 3)) { s.vx = -s.vx; s.x = clamp(s.x, WALL + 3, LW - WALL - 3); s.bounce--; emit(s.x, s.y, '#fffcf0', 3, 20); }
    if (s.hold) { if (s.t < s.hold) { s.vx *= 1 - dt * 4; s.vy *= 1 - dt * 4; if (Math.random() < 0.3) emit(s.x, s.y, '#ff5a6e', 1, 10, 1, 0.2, { g: 0 }); } else { const a = Math.atan2(PLAT_Y - s.y, G.room.plat.x - s.x); s.vx = Math.cos(a) * s.hsp; s.vy = Math.sin(a) * s.hsp; s.hold = 0; sfx.play('launch', 1.6); } }
    if (s.kind === 'bubble') s.vx = Math.sin(G.t * 3 + s.wob) * 25;
    if (s.kind === 'shard' && s.vy < 15 && s.y < 60) s.vy += 40 * dt;
    s.sp.at(s.x, s.y);
    if (s.red) { s.sp.setFrame(Math.floor(s.t * 10) % 2); if (Math.random() < 0.45) emit(s.x, s.y, '#ff2a3a', 1, 6, 1, 0.22, { g: 0 }); }
    if (s.enemy) {
      if (s.y > PLAT_Y - 4 && s.y < PLAT_Y + 6 && (Math.abs(s.x - plat.x) < plat.w / 2 + 2 || (plat.twin && Math.abs(s.x - (LW - plat.x)) < plat.w / 2 + 2))) { s.dead = true; shotHitsPlatform(s); }
      for (const b of Rm.balls) if (!b.caught && dist(b.x, b.y, s.x, s.y) < b.r + 3) { s.dead = true; emit(s.x, s.y, '#fffcf0', 5, 30); sfx.play('wall', 1.5); }
    } else {
      if (s.kind === 'rocket' && Math.random() < 0.6) emit(s.x, s.y + 3, pick(['#ffd45c', '#ff7a2a']), 1, 10, 1, 0.3, { g: 0 });
      if (s.kind === 'star' && Math.random() < 0.5) emit(s.x, s.y, '#fff27a', 1, 6, 1, 0.3, { g: 0 });
      for (const e of Rm.enemies) if (!e.dead && !e.ghost && dist(e.x, e.y, s.x, s.y) < e.r + 3) { s.dead = true; if (s.kind === 'rocket') boom(s.x, s.y, syn('feuerwerk') ? 28 : 15, s.dmg, null); else hitEnemy(e, null, s.dmg, 'shot'); break; }
    }
    if (s.y > PLAT_Y + 30 || s.y < TOP || s.x < WALL - 4 || s.x > LW - WALL + 4) s.dead = true;
  }
  Rm.shots = Rm.shots.filter((s) => (s.dead ? (s.sp.remove(), false) : true));

  updateExtras(dt);
  // --- Münzen
  for (const c of Rm.coins) {
    c.t += dt;
    if (c.t < 0.28) { c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= 1 - dt * 4; c.vy *= 1 - dt * 4; }
    else { const k = Math.min(1, (c.t - 0.28) * 2.6); c.x += (c.tx - c.x) * k * k; c.y += (c.ty - c.y) * k * k; }
    c.sp.at(c.x, c.y);
    if (c.t > 0.3 && dist(c.x, c.y, c.tx, c.ty) < 4) {
      c.dead = true;
      if (c.heart) heal(1); else { R.cf = (R.cf || 0) + (1 + 0.4 * lvl('goldgier')); const cg = Math.floor(R.cf + 1e-6); R.cf -= cg; R.coins += cg * (syn('goldrausch') ? 2 : 1) * (PL().gold ? 2 : 1) * (rel('gier') ? 2 : 1); sfx.play('coin'); bumpHud(); }
      updateHud();
    }
  }
  Rm.coins = Rm.coins.filter((c) => (c.dead ? (c.sp.remove(), false) : true));

  // --- Bossleiste
  bossBarBg.visible = bossBar.visible = !!(Rm.boss && !Rm.boss.dead);
  if (Rm.boss) placeRect(bossBar, 31, TOP + 5, 118 * Math.max(0, Rm.boss.hp / Rm.boss.max), 2);

  Rm.ink = Math.max(0, Rm.ink - dt); inkRect.material.opacity = Math.min(0.82, Rm.ink * 0.6);
  // --- Event-Level
  if (Rm.ev && Rm.state !== 'clear' && Rm.state !== 'dead') {
    if (Rm.evT > 0) { Rm.evT -= dt; G.hint = `ZEIT ${Math.ceil(Rm.evT)}`; }
    if (Rm.ev === 'ansturm') { Rm.surge -= dt; if (Rm.surge <= 0 && Rm.enemies.length < 22) { Rm.surge = 4; Rm.waves = 1; spawnWave(); } }
    if (Rm.ev === 'kernjagd' && !Rm.enemies.some((e) => e.target && !e.dead)) { for (const e of Rm.enemies) { e.dead = true; killSprites(e); emit(e.x, e.y, '#ffd45c', 8, 50); } Rm.enemies = []; }
    if (Rm.evT <= 0 && EVENT_LEVELS[Rm.ev].time > 0) {
      if (Rm.ev === 'kernjagd') { hurt(1, 'event'); banner('ZEIT UM!', 0.8); }
      for (const e of Rm.enemies) { e.dead = true; killSprites(e); emit(e.x, e.y, '#fffcf0', 6, 40); } Rm.enemies = []; G.hint = '';
    }
  }
  // --- Raum geschafft?
  if (Rm.state !== 'clear' && Rm.state !== 'dead' && Rm.enemies.length === 0) {
    Rm.state = 'clear'; Rm.clearT = 0; sfx.play('win'); banner(Rm.type === 'boss' ? 'SIEG!' : 'GESCHAFFT!', 1.2);
    for (const b of Rm.balls) if (!b.main) b.life = 0.01;
  }
  if (Rm.state === 'clear') { Rm.clearT += dt; if (Rm.clearT > 1.5 && Rm.coins.length === 0) roomDone(); }

  { const el = $('momBar'); const m = Rm.mom; el.style.display = m > 0.05 ? 'flex' : 'none'; if (m > 0.05) { el.querySelector('b').textContent = 'SCHWUNG x' + Math.ceil(m); el.querySelector('i').style.width = Math.min(100, (m / 12) * 100) + '%'; el.querySelector('i').style.background = m > 8 ? '#ff5a6e' : m > 4 ? '#ff9a4a' : '#ffd45c'; } }
  if (Rm.state === 'dead') { Rm.deadT -= dt; if (Rm.deadT <= 0) return gameOver(); }
  // Hinweis
  $('hint').textContent = G.hint;
  aimUpdate();
}

function spawnHole(x, y) {
  fx('schwarzloch');
  const big = syn('horizont');
  G.room.holes.push({ x, y, r: big ? 38 : 24, t: 2.6, tick: 0, sp: new Sprite('assets/misc/fx_hole0.png', 14, 14, 1, { z: 7, parent: world }), big });
  sfx.play('roar'); banner('SCHWARZES LOCH!', 0.6);
}
function quake() {
  fx('erdbeben');
  G.shake = 0.45; sfx.play('boom'); banner('ERDBEBEN!', 0.5);
  for (let x = WALL; x < LW - WALL; x += 6) emit(x, PLAT_Y - 4, '#a8743f', 1, 50, 2, 0.5, { angle: -Math.PI / 2, spread: 0.6 });
  for (const o of G.room.enemies) if (!o.dead) { o.sq = 0.14; hitEnemy(o, null, 1, 'chain'); }
}
function strike(e) {
  fx('gewitter');
  for (let y = TOP; y < e.y; y += 4) emit(e.x + Math.sin(y * 0.7) * 3, y, '#ffe14d', 1, 4, 1, 0.18, { g: 0, up: 0 });
  sfx.play('zap'); G.shake = Math.max(G.shake, 0.12); ring(e.x, e.y, '#ffe14d');
  hitEnemy(e, null, 3, 'chain'); if (syn('sturmfront')) chain(e, 2);
}
function updateExtras(dt) {
  const Rm = G.room, plat = Rm.plat, b = mainBall();
  // Glutspur
  if (lvl('glutspur') && b && !b.caught) {
    b.emT = (b.emT || 0) - dt;
    if (b.emT <= 0 && Rm.hazards.length < 40) { b.emT = 0.09; fx('glutspur'); Rm.hazards.push({ x: b.x, y: b.y, t: syn('lavastrom') ? 2 : 1.1, hit: new Set(), sp: new Sprite('assets/misc/fx_ember.png', 4, 4, 1, { z: 6, parent: world }) }); }
  }
  for (const h of Rm.hazards) {
    h.t -= dt; h.sp.at(h.x, h.y); h.sp.opacity = Math.min(1, h.t * 2);
    if (Math.random() < dt * 6) emit(h.x, h.y, '#ff7a2a', 1, 8, 1, 0.3, { g: -40 });
    for (const e of Rm.enemies) if (!e.dead && !h.hit.has(e) && dist(e.x, e.y, h.x, h.y) < e.r + 2) { h.hit.add(e); e.burn = Math.max(e.burn, 1.5); hitEnemy(e, null, 0.5 * lvl('glutspur') * (syn('lavastrom') ? 2 : 1), 'dot'); }
  }
  Rm.hazards = Rm.hazards.filter((h) => (h.t <= 0 ? (h.sp.remove(), false) : true));
  // Sägen
  for (const sw of Rm.saws) {
    sw.a += dt * 7; const cx = b ? b.x : plat.x, cy = b ? b.y : PLAT_Y - 8; const R = (b ? b.r : 6) + 8;
    const x = cx + Math.cos(sw.a) * R, y = cy + Math.sin(sw.a) * R; sw.sp.at(x, y); sw.sp.flip = Math.floor(G.t * 16) % 2 === 0;
    for (const e of Rm.enemies) if (!e.dead && !e.ghost && dist(e.x, e.y, x, y) < e.r + 4 && !(e.sawCd > 0)) { e.sawCd = 0.3; fx('saege'); hitEnemy(e, null, lvl('saege'), 'shot'); emit(x, y, '#c9cbd6', 4, 40); }
  }
  for (const e of Rm.enemies) if (e.sawCd > 0) e.sawCd -= dt;
  // Echo
  for (const ec of Rm.echoes) { ec.t -= dt; if (ec.t <= 0 && !ec.e.dead) { ring(ec.e.x, ec.e.y, '#7fd6ef'); hitEnemy(ec.e, null, ec.dmg, 'echo'); } }
  Rm.echoes = Rm.echoes.filter((ec) => ec.t > 0);
  // Laser
  if (lvl('laser') && Rm.state !== 'clear') {
    Rm.laserT -= dt;
    if (Rm.laserT <= 0) {
      Rm.laserT = (lvl('laser') === 2 ? 3 : 4) / (syn('todesstrahl') ? 2 : 1);
      if (!Rm.beam) Rm.beam = rect(0, 0, 3, 1, '#ff5a6e', 13, 0.9, world);
      Rm.beamT = 0.18; Rm.beamX = plat.x; sfx.play('zap'); fx('laser');
      for (const e of Rm.enemies) if (!e.dead && Math.abs(e.x - plat.x) < e.r + 2) hitEnemy(e, null, 2 * lvl('laser'), 'shot');
    }
  }
  if (Rm.beam) { Rm.beamT -= dt; Rm.beam.visible = Rm.beamT > 0; if (Rm.beamT > 0) { placeRect(Rm.beam, Rm.beamX - 1 - (Rm.beamT > 0.1 ? 1 : 0), TOP, Rm.beamT > 0.1 ? 5 : 3, PLAT_Y - TOP); Rm.beam.material.color.set(Math.floor(G.t * 30) % 2 ? '#ff5a6e' : '#fffcf0'); } }
  // Raketen
  if (lvl('rakete') && Rm.state !== 'clear') { Rm.rocketT -= dt; if (Rm.rocketT <= 0) { Rm.rocketT = 5.5 - lvl('rakete'); const tg = pick(Rm.enemies.filter((e) => !e.dead && !e.ghost)); if (tg) { shoot(plat.x, PLAT_Y - 6, 'rocket', rnd(-40, 40), -110, false, 2, tg); sfx.play('launch'); fx('rakete'); } } }
  // Gewitter
  if (lvl('gewitter') && Rm.state !== 'clear') { Rm.stormT -= dt; if (Rm.stormT <= 0) { Rm.stormT = 7 - lvl('gewitter') * 1.3; const tg = pick(Rm.enemies.filter((e) => !e.dead)); if (tg) strike(tg); } }
  // Schwarze Löcher
  for (const h of Rm.holes) {
    h.t -= dt; h.tick -= dt; h.sp.at(h.x, h.y); const sc = (h.big ? 2.4 : 1.6) * Math.min(1, h.t * 2, (2.6 - h.t) * 4 + 0.2); h.sp.sx = h.sp.sy = sc; h.sp.flip = Math.floor(G.t * 8) % 2 === 0;
    if (Math.random() < dt * 30) { const a = rnd(0, 6.28); emit(h.x + Math.cos(a) * h.r, h.y + Math.sin(a) * h.r, '#9a76d0', 1, 0, 1, 0.3, { g: 0, up: 0 }); }
    for (const e of Rm.enemies) if (!e.dead && !e.boss && dist(e.x, e.y, h.x, h.y) < h.r) { e.hx += Math.sign(h.x - e.x) * 30 * dt; e.hy += Math.sign(h.y - e.y) * 20 * dt; if (h.tick <= 0) hitEnemy(e, null, 1, 'dot'); }
    if (h.tick <= 0) h.tick = 0.4;
  }
  Rm.holes = Rm.holes.filter((h) => (h.t <= 0 ? (h.sp.remove(), false) : true));
  // Bumper
  for (const bp of Rm.bumpers) { bp.fl = Math.max(0, bp.fl - dt * 4); bp.sp.flash = bp.fl * 0.8; bp.sp.flashColor('#ffd45c'); bp.sp.sx = bp.sp.sy = 1 + bp.fl * 0.2; bp.sp.at(bp.x, bp.y); }
}
function updateBall(b, dt) {
  const Rm = G.room, plat = Rm.plat;
  b.t += dt; b.boost -= dt; b.ram -= dt; b.lava = (b.lava || 0) - dt; b.hitAnim -= dt; b.skillAnim -= dt;
  if (b.main && !b.caught && Rm.mom >= 3) { const m = Math.min(12, Rm.mom); const cols = m >= 10 ? ['#ff4a7a', '#c08bff', '#fffcf0'] : m >= 6 ? ['#ff7a2a', '#ff2a3a', '#ffd45c'] : ['#ffd45c', '#fff27a']; for (let i = 0; i < 1 + (m >> 2); i++) emit(b.x + rnd(-2, 2), b.y + rnd(-2, 2), pick(cols), 1, 8 + m, m >= 6 ? 2 : 1, 0.25 + m * 0.02, { g: -10 }); }
  if (!b.main) { b.life -= dt; if (b.life <= 0) { b.dead = true; } }
  if (b.caught) {
    b.x = plat.x + (b.cx || 0); b.y = PLAT_Y - b.r - 1; b.vx = b.vy = 0;
  } else {
    const S = speedOf(b);
    const steps = Math.ceil(S * dt / 3);
    const h = dt / steps;
    for (let i = 0; i < steps && !b.caught && !b.dead; i++) {
      if (!(b.ram > 0)) b.vy += GRAV * h;
      // Magnet der Plattform
      if (b.main && PL().pull && b.vy > 0 && b.y > 120) b.vx += Math.sign(plat.x - b.x) * 380 * h;
      if (b.main && PL().homing) { const t = nearestEnemy(b.x, b.y); if (t && t.y < b.y) { const a1 = Math.atan2(b.vy, b.vx), a2 = Math.atan2(t.y - b.y, t.x - b.x); let da = a2 - a1; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; const na = a1 + clamp(da, -1.4 * h, 1.4 * h); const v = Math.hypot(b.vx, b.vy); b.vx = Math.cos(na) * v; b.vy = Math.sin(na) * v; } }
      if (b.main && lvl('magnet') && b.vy > 0 && b.y > 150) { b.vx += Math.sign(plat.x - b.x) * 90 * lvl('magnet') * h; FXC.magnet = (FXC.magnet || 0) + h; }
      // Magnetling
      for (const e of Rm.enemies) if (!e.dead && e.def.pull && dist(e.x, e.y, b.x, b.y) < e.def.pull) { const a = Math.atan2(e.y - b.y, e.x - b.x); b.vx += Math.cos(a) * 220 * h; b.vy += Math.sin(a) * 220 * h; }
      const v = Math.hypot(b.vx, b.vy) || 1; b.vx = b.vx / v * S; b.vy = b.vy / v * S;
      if (Math.abs(b.vy) < S * 0.22) { b.vy = Math.sign(b.vy || 1) * S * 0.22; const v2 = Math.hypot(b.vx, b.vy); b.vx = b.vx / v2 * S; b.vy = b.vy / v2 * S; }
      b.x += b.vx * h; b.y += b.vy * h;
      // Wände
      if (b.x < WALL + b.r) { b.x = WALL + b.r; b.vx = Math.abs(b.vx); wallHit(b); }
      if (b.x > LW - WALL - b.r) { b.x = LW - WALL - b.r; b.vx = -Math.abs(b.vx); wallHit(b); }
      if (b.y < TOP + b.r) { b.y = TOP + b.r; b.vy = Math.abs(b.vy); wallHit(b); if (b.ram > 0) b.ram = 0; }
      // Flipper-Bumper
      for (const bp of Rm.bumpers) {
        const d = dist(b.x, b.y, bp.x, bp.y), rr = b.r + bp.r;
        if (d < rr) { const nx = (b.x - bp.x) / (d || 1), ny = (b.y - bp.y) / (d || 1); const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; } b.x = bp.x + nx * rr; b.y = bp.y + ny * rr; b.boost = 0.6; if (b.main) b.charge = Math.min(4, b.charge + 1); bp.fl = 1; fx('flipper'); sfx.play('bumper'); ring(bp.x, bp.y, '#ffd45c'); }
      }
      // Gegner
      for (const e of Rm.enemies) {
        if (e.dead || e.ghost) continue;
        const d = dist(b.x, b.y, e.x, e.y), rr = b.r + e.r - 1;
        if (d < rr) {
          const nx = (b.x - e.x) / (d || 1), ny = (b.y - e.y) / (d || 1);
          if (e.hitCd <= 0 && b.main && Math.random() < 0.2 * lvl('phase') + 0.15 * elF('schatten')) { b.phaseE = e; emit(b.x, b.y, '#c8b8ff', 6, 30); if (lvl('phase')) fx('phase'); }
          const through = b.ram > 0 || b.pierce > 0 || b.phaseE === e;
          if (e.hitCd <= 0) {
            let dmg = baseDmg() + (b.main ? b.charge : 0) + (b.ram > 0 ? 1 : 0);
            if (!b.main && !syn('schwarm')) dmg = Math.max(1, dmg * 0.5);
            b.charge = 0; e.hitCd = 0.12; b.hitAnim = 0.15;
            const wasPierce = b.pierce > 0 && !(b.ram > 0);
            hitEnemy(e, b, dmg);
            if (e.def.reflect) { b.boost = 0.7; emit(b.x, b.y, '#68cae8', 6, 50); }
            if (wasPierce) b.pierce--;
            if (b.main) { Rm.flightHits = (Rm.flightHits || 0) + 1; }
          }
          if (!through || (e.boss && !(b.ram > 0))) {
            const vn = b.vx * nx + b.vy * ny;
            if (vn < 0) { b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; }
            b.x = e.x + nx * rr; b.y = e.y + ny * rr;
          }
        }
      }
      if (b.phaseE && dist(b.x, b.y, b.phaseE.x, b.phaseE.y) > b.r + b.phaseE.r + 2) b.phaseE = null;
      // Plattform
      const onTwin = plat.twin && Math.abs(b.x - (LW - plat.x)) <= plat.w / 2 + b.r * 0.5;
      if (b.vy > 0 && b.y + b.r >= PLAT_Y - 1 && b.y + b.r <= PLAT_Y + 7 && (Math.abs(b.x - plat.x) <= plat.w / 2 + b.r * 0.5 || onTwin)) {
        b.hitX = onTwin ? LW - plat.x : plat.x;
        if (b.main) bounceMain(b, S);
        else { const off = (b.x - plat.x) / (plat.w / 2); const a = -Math.PI / 2 + off * 0.9; b.vx = Math.cos(a) * S; b.vy = Math.sin(a) * S; b.y = PLAT_Y - b.r - 1; sfx.play('wall', 1.3); }
      }
      if (b.y > PLAT_Y + 34) {
        if (b.main) miss(b); else b.dead = true;
      }
    }
  }
  if (b.dead) { b.sp.remove(); Rm.balls.splice(Rm.balls.indexOf(b), 1); return; }
  // Animation
  if (b.main) {
    const fr = b.skillAnim > 0 ? 10 + (Math.floor(b.t * 10) % 4) : b.hitAnim > 0 ? 8 + (Math.floor(b.t * 12) % 2) : b.caught ? Math.floor(b.t * 5) % 4 : 4 + (Math.floor(b.t * 10) % 4);
    b.sp.setFrame(fr); b.sp.flip = b.vx < -1;
    b.sp.at(b.x, b.y - 1);
    if (b.main && !b.caught && G.room.mom >= 1) for (let i = 0; i < Math.ceil(G.room.mom / 3); i++) emit(b.x, b.y, G.room.mom > 8 ? '#ff5a6e' : G.room.mom > 4 ? '#ff9a4a' : '#ffd45c', 1, 10, 1, 0.3, { g: 0, up: 0 });
    if (!b.caught && Math.random() < dt * 60) emit(b.x, b.y, b.ram > 0 ? '#ffd45c' : lvl('feuer') ? '#ff7a2a' : lvl('gift') ? '#7ad35a' : lvl('frost') ? '#bfefff' : '#fffcf0', 1, 4, 1, 0.25, { g: 0, up: 0 });
  } else b.sp.at(b.x, b.y);
}
function wallHit(b) {
  sfx.play('wall');
  emit(b.x, b.y, '#fffcf0', 2, 20, 1, 0.2);
  if (!b.main) return;
  if (++G.room.wallC % 3 === 0) autoSkill('wand');
  if (lvl('wandknall')) { b.charge = Math.min(3, b.charge + 1); fx('wandknall'); }
  if (lvl('funkenspur')) fx('funkenspur');
  if (lvl('funkenspur')) for (let i = 0; i < (syn('funkenregen') ? 2 : 1); i++) { const tg = nearestEnemy(b.x, b.y); if (tg) { const a = Math.atan2(tg.y - b.y, tg.x - b.x) + i * 0.5; shoot(b.x, b.y, 'spark', Math.cos(a) * 120, Math.sin(a) * 120, false, lvl('funkenspur') + (syn('funkenregen') ? b.charge : 0), tg); } }
  if (lvl('prisma') && Math.random() < 0.2 * lvl('prisma') && G.room.balls.length < 9) { const a = Math.atan2(b.vy, b.vx) + rnd(-0.6, 0.6); spawnBall(false, b.x, b.y, Math.cos(a) * 150, Math.sin(a) * 150); emit(b.x, b.y, pick(['#ff5a6e', '#ffd45c', '#6fd0f0']), 8, 40); fx('prisma'); }
}
function nearestEnemy(x, y) { let best = null, bd = 1e9; for (const e of G.room.enemies) { if (e.dead || e.ghost) continue; const d = dist(x, y, e.x, e.y); if (d < bd) { bd = d; best = e; } } return best; }
function catchBall(b) {
  const Rm = G.room, plat = Rm.plat;
  b.caught = true; b.cx = clamp(b.x - plat.x, -plat.w / 2 + 4, plat.w / 2 - 4); b.vx = b.vy = 0; b.pierce = 0; b.ram = 0;
  Rm.state = Rm.state === 'clear' ? 'clear' : 'aim'; Rm.combo = 0; Rm.skillUses = 0; Rm.flightHits = 0;
  plat.squash = 0.15;
  if (Math.abs(b.cx) < 4) {
    sfx.play('perfect'); emit(b.x, PLAT_Y, '#ffd45c', 8, 40);
    if (lvl('trampolin')) { fx('trampolin'); b.charge += 2 * lvl('trampolin'); banner('PERFEKT +' + 2 * lvl('trampolin'), 0.5); }
  } else sfx.play('catch');
  b.cx = 0;
}
function bounceMain(b, S) {
  const Rm = G.room, plat = Rm.plat, P = PL();
  const off = clamp((b.x - (b.hitX ?? plat.x)) / (plat.w / 2), -1, 1);
  const a = -Math.PI / 2 + off * 1.05 + (P.randAngle ? rnd(-0.55, 0.55) : 0);
  b.vx = Math.cos(a) * S; b.vy = Math.sin(a) * S; b.y = PLAT_Y - b.r - 1;
  b.pierce = 0; b.ram = 0;
  Rm.combo = 0; Rm.skillUses = 0; Rm.flightHits = 0; b.parried = false;
  plat.squash = 0.12;
  if (P.catchAll && Rm.state !== 'clear') { b.caught = true; b.cx = clamp(b.x - plat.x, -plat.w / 2 + 3, plat.w / 2 - 3); b.vx = b.vy = 0; Rm.state = 'aim'; sfx.play('catch'); return; }
  if (P.bounceCharge) b.charge = Math.min(6, b.charge + P.bounceCharge);
  if (P.lava) { b.lava = 3; emit(b.x, b.y, '#ff7a2a', 8, 40); }
  if (P.split && Rm.balls.filter((x) => !x.main).length < 4) { const a2 = -Math.PI / 2 + rnd(-0.7, 0.7); spawnBall(false, b.x, b.y - 4, Math.cos(a2) * S, Math.sin(a2) * S); }
  if (P.portal) { ring(b.x, b.y, '#c08bff'); b.x = rnd(24, 156); b.y = TOP + 10; b.vy = Math.abs(b.vy) * 0.8; ring(b.x, b.y, '#c08bff'); sfx.play('zap'); }
  autoSkill('abprall');
  if (lvl('schrot')) fx('schrot');
  for (let i = 0; i < (lvl('schrot') ? 3 : 0); i++) shoot(plat.x + (i - 1) * 8, PLAT_Y - 4, 'pellet', (i - 1) * 45, -190, false, lvl('schrot'));
  if (Math.abs(off) < (lvl('sternschnuppe') ? 0.25 : 0.17)) {
    sfx.play('perfect'); emit(b.x, PLAT_Y, '#ffd45c', 8, 40);
    if (lvl('sternschnuppe')) fx('sternschnuppe');
    if (lvl('sternschnuppe')) { const n = syn('sternhagel') ? 6 : 3; for (let i = 0; i < n; i++) { const tg = pick(Rm.enemies.filter((e) => !e.dead && !e.ghost)); const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.35; shoot(b.x, b.y - 6, 'star', Math.cos(a) * 140, Math.sin(a) * 140, false, 1 + lvl('sternschnuppe'), tg); } }
    if (lvl('trampolin')) { fx('trampolin'); b.charge += 2 * lvl('trampolin'); banner('PERFEKT +' + 2 * lvl('trampolin'), 0.5); }
  } else { sfx.play('catch'); emit(b.x, PLAT_Y, '#fffcf0', 4, 30); }
}
function miss(b) {
  const Rm = G.room;
  if (PL().ghost && !(Rm.ghostT > 0)) { Rm.ghostT = PL().ghost; b.y = PLAT_Y - 12; b.vy = -Math.abs(b.vy); emit(b.x, PLAT_Y, '#d8d0ff', 16, 60, 2); sfx.play('bumper'); banner('GEISTERRETTUNG!', 0.6); return; }
  if (Rm.kuppel > 0) {
    Rm.kuppel--; fx('kuppel'); b.y = PLAT_Y - 10; b.vy = -Math.abs(b.vy); b.vx *= 0.5; emit(b.x, PLAT_Y, '#7fd6ef', 14, 60, 2); sfx.play('bumper'); banner('KUPPEL!', 0.5); return;
  }
  G.room.mom = 0; b.caught = true; b.cx = 0; const wasClear = Rm.state === 'clear'; if (!wasClear && Rm.state !== 'dead') Rm.state = 'aim'; Rm.combo = 0; Rm.skillUses = 0;
  if (!wasClear) hurt(1, 'miss');
}

// --- Gegnerverhalten
function updateEnemy(e, dt) {
  const Rm = G.room, def = e.def, plat = Rm.plat;
  const sm = e.slow > 0 ? 0.45 : 1; const am = sm * (1 / e.atkMul) * (1 - 0.1 * lvl('zeitlupe')) * (rel('zorn') ? 1.5 : 1);
  e.t += dt * sm; e.fl = Math.max(0, e.fl - dt * 5); e.hitCd -= dt; e.slow -= dt;
  // Status
  if (e.burn > 0) { e.burn -= dt; e.burnT = (e.burnT || 0) + dt; if (e.burnT > 1) { e.burnT = 0; hitEnemy(e, null, 0.5 + 0.5 * lvl('feuer'), 'dot'); emit(e.x, e.y - 4, '#ff7a2a', 3, 20); } }
  if (e.poison > 0) { e.poisT = (e.poisT || 0) + dt; if (e.poisT > 1) { e.poisT = 0; hitEnemy(e, null, e.poison * 0.3, 'dot'); emit(e.x, e.y, '#7ad35a', 2, 15); } }
  if (e.dead) return;
  // Bewegung
  e.by += (e.hy - e.by) * Math.min(1, dt * 4);
  if (e.boss) return updateBoss(e, dt);
  if (def.hop) {
    e.hopT = (e.hopT ?? rnd(1, 4)) - dt * sm;
    if (e.hopT <= 0 && !e.hop) { const d = pick([-16, 16]); e.hop = { t: 0, from: e.hx, to: clamp(e.hx + d, 18, 162) }; }
    if (e.hop) { e.hop.t += dt * 2.6; const p = Math.min(1, e.hop.t); e.hx = e.hop.from + (e.hop.to - e.hop.from) * p; e.oy = -Math.sin(p * Math.PI) * 10; if (p >= 1) { e.hop = null; e.oy = 0; e.hopT = rnd(2, 4.5); e.sq = 0.14; emit(e.x, e.y + 7, '#b6e88a', 3, 20); } }
  }
  if (def.move === 'side') e.ox = Math.sin(e.t * 1.6) * 14;
  if (def.move === 'vbob') e.oy = Math.sin(e.t * 1.8) * 9;
  if (def.move === 'orbit') { e.ox = Math.cos(e.t * 2) * 9; e.oy = Math.sin(e.t * 2) * 7; }
  if (def.move === 'figure8') { e.ox = Math.sin(e.t * 1.5) * 14; e.oy = Math.sin(e.t * 3) * 6; }
  if (def.balloon) { e.hy = Math.max(TOP + 16, e.hy - 3 * dt); e.ox = Math.sin(e.t * 1.2) * 10; }
  if (def.clam) { e.ct = (e.ct || 0) + dt; if (e.ct > def.clam) { e.ct = 0; e.open = !e.open; } }
  if (def.inflate && e.puffT > 0) e.puffT -= dt;
  if (def.regen && e.hp < e.max) { e.rt = (e.rt || 0) + dt; if (e.rt > def.regen) { e.rt = 0; e.hp = Math.min(e.max, e.hp + 1); emit(e.x, e.y - 6, '#6fd36a', 3, 20, 1, 0.5, { g: -30 }); } }
  if (e.affix === 'heilend' && e.hp < e.max) { e.rt2 = (e.rt2 || 0) + dt; if (e.rt2 > 2.5) { e.rt2 = 0; e.hp = Math.min(e.max, e.hp + 2); emit(e.x, e.y - 6, '#6fd36a', 4, 20, 1, 0.5, { g: -30 }); } }
  if (def.wind) { const b = mainBall(); if (b && !b.caught && dist(b.x, b.y, e.x, e.y) < def.wind) { b.vx += Math.sign(b.x - e.x || 1) * 260 * dt; if (Math.random() < dt * 20) emit(e.x + rnd(-8, 8), e.y + 6, '#e8fbff', 1, 40, 1, 0.3, { angle: b.x > e.x ? 0 : Math.PI, g: 0 }); } }
  if (def.move === 'wander') { e.ox = Math.sin(e.t * 1.3) * 18; e.oy = Math.sin(e.t * 2.1) * 8; }
  if (def.move === 'flee') { const b = mainBall(); if (b && !b.caught && dist(b.x, b.y, e.x, e.y) < 40) e.ox += Math.sign(e.x - b.x || 1) * 70 * dt; else e.ox *= 1 - dt; e.ox = clamp(e.ox, -22, 22); }
  let tx = e.hx + (e.noMarch ? 0 : Rm.march.x) + e.ox, ty = e.by + e.oy;
  // Spezialfähigkeiten
  e.atk -= dt * am;
  if (def.shoot || (def.mimic && e.awake)) {
    const every = def.shoot ? def.shoot.every : 3.2;
    if (e.atk < 0.6 && !e.telegraph) { e.telegraph = 1; if (def.shoot) e.nextPat = choosePat(e); }
    if (e.telegraph && def.shoot) warnFx(e);
    if (e.atk <= 0) { e.atk = every * rnd(0.85, 1.2); e.telegraph = 0; if (Rm.state !== 'clear') enemyAttack(e); }
  }
  if (def.swoop) {
    if (e.state === 'idle' && e.atk <= 0 && !Rm.noAttack) { e.state = 'swoop'; e.sw = { t: 0, sx: e.x, sy: e.by, tx: plat.x, hit: false }; }
    if (e.state === 'swoop') {
      const s = e.sw; s.t += dt * sm;
      const p = s.t / 2.2; const yy = s.sy + Math.sin(Math.min(1, p) * Math.PI) * (PLAT_Y - 14 - s.sy);
      tx = s.sx + (s.tx - s.sx) * Math.sin(Math.min(1, p) * Math.PI); ty = yy;
      if (!s.hit && ty > PLAT_Y - 16 && Math.abs(tx - plat.x) < plat.w / 2 + 4) { s.hit = true; hurt(1, 'swoop'); plat.stun = 0.4; }
      if (p >= 1) { e.state = 'idle'; e.atk = def.swoop * rnd(0.8, 1.2); e.oy = 0; }
      e.ox = tx - e.hx; e.oy = ty - e.by;
    }
  }
  if (def.dive) {
    if (e.state === 'idle' && e.atk <= 0 && !Rm.noAttack) { e.state = 'warn'; e.wt = 0.8; e.telegraph = 1; sfx.play('stun'); }
    if (e.state === 'warn') { e.wt -= dt; tx += Math.sin(e.t * 40); if (e.wt <= 0) { e.state = 'dive'; e.vy = 30; e.telegraph = 0; } }
    if (e.state === 'dive') {
      e.vy += 160 * dt; e.hy += e.vy * dt; e.by = e.hy; ty = e.by; e.y = ty;
      if (e.y > PLAT_Y - 6) {
        if (Math.abs(e.x - plat.x) < plat.w / 2 + 5) hurt(1, 'dive');
        boomSmall(e); return;
      }
    }
  }
  if (def.heal) { e.ht = (e.ht || def.heal) - dt * am; if (e.ht <= 0) { e.ht = def.heal; for (const o of Rm.enemies) if (!o.dead && o !== e && dist(o.x, o.y, e.x, e.y) < 26 && o.hp < o.max) { o.hp = Math.min(o.max, o.hp + 1); emit(o.x, o.y - 6, '#6fd36a', 4, 20, 1, 0.5, { g: -30 }); } } }
  if (def.spawn) { e.st = (e.st || def.spawn) - dt * am; if (e.st <= 0) { e.st = def.spawn; if (Rm.enemies.length < Rm.enemyCap) { const m = addEnemy(def.spawnKind || 'huepfer', e.x + pick([-12, 12]), e.y + 10); m.hx = clamp(m.x, 18, 162); m.hy = e.hy + 10; emit(e.x, e.y, '#ffe9b0', 6, 30); } } }
  if (def.phase) { e.pt = (e.pt || 0) + dt; if (e.pt > def.phase) { e.pt = 0; e.ghost = !e.ghost; } }
  if (def.teleport) { e.tt = (e.tt || def.teleport) - dt * am; if (e.tt <= 0) { e.tt = def.teleport; emit(e.x, e.y, '#9fe8ff', 8, 40); e.hx = COL_X((Math.random() * COLS) | 0); e.hy = clamp(e.hy + rnd(-15, 15), 34, DANGER - 40); e.by = e.hy; e.ox = 0; tx = e.hx; ty = e.by; } }
  if (def.guard) { e.gt = (e.gt || 1) - dt * am; if (e.gt <= 0) { e.gt = def.guard; for (const o of Rm.enemies) if (!o.dead && o !== e && !o.bubble && dist(o.x, o.y, e.x, e.y) < 28) { o.bubble = new Sprite('assets/misc/shard.png', 6, 6, 1, { z: 9, parent: world }); } } }
  if (e.spike !== undefined && e.spike > 0) { e.spike -= dt; if (e.spike <= 0) { for (const s of [-0.3, 0.3]) { const [vx, vy] = aimAtPlatform(e, 65, s); shoot(e.x, e.y + 5, 'spike', vx, vy); } } }
  e.x = clamp(tx, WALL + 7, LW - WALL - 7); e.y = ty;
  drawEnemy(e);
}
function boomSmall(e) { e.dead = true; killSprites(e); emit(e.x, e.y, '#ff7a2a', 14, 60, 2); sfx.play('boom'); G.shake = 0.2; }
function drawEnemy(e) {
  const bob = (e.def.mimic && !e.awake) || e.def.clam ? 0 : Math.sin(e.t * 4) > 0.6 ? 1 : 0;
  e.sp.setFrame(e.def.mimic ? (e.awake ? 1 : 0) : e.def.clam ? (e.open ? 1 : 0) : e.boss ? Math.floor(e.t * 2.5) % 2 : [0, 1, 0, 2, 0, 3][Math.floor(e.t * 6 + e.seed) % 6]);
  const sq = Math.max(0, e.sq || 0) / 0.14; const pf = e.puffT > 0 ? 1.2 : 1; e.sp.sx = (1 + sq * 0.25) * pf; e.sp.sy = (1 - sq * 0.2) * pf; e.sq = (e.sq || 0) - 1 / 60;
  e.sp.flash = e.fl > 0.3 ? 0.85 : 0; e.sp.flashColor('#ffffff');
  if (e.telegraph && Math.floor(G.t * 10) % 2) { e.sp.flash = 0.6; e.sp.flashColor('#ff5a6e'); }
  e.sp.opacity = e.ghost ? 0.35 : 1;
  e.sp.tint(e.slow > 0 ? '#bfe8ff' : e.poison > 0 ? '#d8ffc8' : '#ffffff');
  e.sp.at(e.x, e.y - bob);
  if (e.crown) e.crown.at(e.x, e.y - 11 - bob);
  if (e.bubble) { e.bubble.at(e.x + 6, e.y - 6); }
  // Lebensleiste
  if (!e.boss && (e.hp < e.max || e.elite)) {
    if (!e.hb) e.hb = [rect(0, 0, 14, 3, '#2b1d3a', 12, 1, world), rect(0, 0, 12, 1, e.elite ? '#ffd45c' : '#ff5a6e', 13, 1, world)];
    const yy = e.y + 9;
    placeRect(e.hb[0], e.x - 7, yy, 14, 3); placeRect(e.hb[1], e.x - 6, yy + 1, 12 * Math.max(0, e.hp / e.max), 1);
  }
}

function updateBoss(e, dt) {
  const Rm = G.room, plat = Rm.plat;
  const ph2 = e.hp < e.max * 0.5, ph3 = e.hp < e.max * 0.25;
  const spd = (ph2 ? 0.9 : 0.6) * (e.k === 'grosswackler_wumbo' ? 1.3 : 1);
  e.move += dt * spd;
  if (e.k !== 'madam_miesmohn' || !e.tp) { e.x = (e.bx ?? 90) + Math.sin(e.move) * (e.k === 'grosswackler_wumbo' ? 58 : 50); e.y = 72 + Math.sin(e.move * 2.3) * 4; }
  if (e.shellT > 0) { e.shellT -= dt; e.def.clam = true; e.open = false; if (Math.random() < dt * 10) emit(e.x + rnd(-14, 14), e.y + rnd(-14, 14), '#76658f', 1, 20); } else if (e.k === 'herzog_hartschale') { e.def.clam = false; }
  if (e.windT > 0) { e.windT -= dt; const b = mainBall(); if (b && !b.caught) b.vx += e.windDir * 160 * dt; if (Math.random() < dt * 40) emit(e.windDir > 0 ? WALL + 2 : LW - WALL - 2, rnd(TOP, PLAT_Y), '#e8fbff', 1, 120, 1, 0.5, { angle: e.windDir > 0 ? 0 : Math.PI, spread: 0.1, g: 0, up: 0 }); }
  e.atk -= dt * (e.slow > 0 ? 0.5 : 1);
  if (e.atk < 0.7 && !e.telegraph) e.telegraph = 1;
  if (e.atk <= 0 && Rm.state !== 'clear') {
    e.telegraph = 0; e.atk = ph3 ? 1.8 : ph2 ? 2.3 : 3.1;
    const fan = (n, sp, kind = 'seed') => { for (let i = 0; i < n; i++) { const [vx, vy] = aimAtPlatform(e, sp, (i - (n - 1) / 2) * 0.22); shoot(e.x, e.y + 12, kind, vx, vy); } sfx.play('launch'); };
    const summon = (k, n = 2) => { if (Rm.enemies.length < 10) for (let i = 0; i < n; i++) { const dx = (i - (n - 1) / 2) * 40; const s2 = addEnemy(k, e.x + dx, e.y + 20); s2.hx = clamp(e.x + dx, 18, 162); s2.hy = e.y + 26; } sfx.play('roar'); };
    const rain = (n, kind = 'rock') => { G.shake = 0.35; sfx.play('boom'); for (let i = 0; i < n; i++) { const x = i === 0 ? plat.x : rnd(20, 160); setTimeout(() => G.room === Rm && shoot(x, TOP + 4, kind, 0, 20), 350 + i * 220); } };
    const spiral = (n) => { for (let i = 0; i < n; i++) setTimeout(() => { if (G.room !== Rm || e.dead) return; const a = i * 0.55; shoot(e.x, e.y, 'spiral', Math.cos(a) * 60, Math.abs(Math.sin(a)) * 50 + 20); }, i * 90); sfx.play('launch'); };
    const m = e.phase++ % 3;
    switch (e.k) {
      case 'koenig_knoll': [() => fan(ph2 ? 7 : 5, 62), () => summon(ph2 ? pick(['ruebi', 'huepfer', 'knuffel']) : 'huepfer'), () => rain(ph2 ? 5 : 3)][m](); break;
      case 'baron_blubber': [
        () => { for (let i = 0; i < (ph2 ? 7 : 5); i++) { const s2 = shoot(rnd(30, 150), e.y + 10, 'bubble', rnd(-15, 15), 28 + rnd(0, 12)); s2.wob = rnd(0, 6); } sfx.play('pop'); },
        () => { const gap = (Math.random() * 7) | 0; for (let i = 0; i < 9; i++) if (Math.abs(i - gap) > (ph2 ? 0 : 1)) shoot(18 + i * 18, TOP + 6, 'seed', 0, 58); sfx.play('launch'); },
        () => summon(pick(['schwebsi', 'blubbser', 'quallo']))][m](); break;
      case 'herzog_hartschale': [
        () => { e.shellT = 2.6; for (let i = 0; i < (ph2 ? 12 : 8); i++) { const a = i / (ph2 ? 12 : 8) * Math.PI * 2; shoot(e.x, e.y, 'shard', Math.cos(a) * 55, Math.sin(a) * 55); } sfx.play('armor'); },
        () => rain(ph2 ? 6 : 4, 'shard'),
        () => summon(pick(['steinbeisser', 'keksquell', 'knallknolle']))][m](); break;
      case 'grosswackler_wumbo': [
        () => { e.windT = 2.4; e.windDir = Math.random() < 0.5 ? -1 : 1; banner('STURMBÖE!', 0.6); sfx.play('roar'); },
        () => { for (let i = 0; i < (ph2 ? 4 : 3); i++) { const x = i === 0 ? plat.x : rnd(20, 160); setTimeout(() => { if (G.room !== Rm) return; for (let y = TOP; y < PLAT_Y; y += 5) emit(x + Math.sin(y) * 2, y, '#fff27a', 1, 4, 1, 0.12, { g: 0 }); }, 200 + i * 300); setTimeout(() => { if (G.room !== Rm) return; for (let y = TOP; y < PLAT_Y; y += 3) emit(x + rnd(-2, 2), y, '#ffe14d', 1, 10, 2, 0.25, { g: 0 }); sfx.play('zap'); if (Math.abs(plat.x - x) < plat.w / 2 + 3) hurt(1, 'blitz'); }, 900 + i * 300); } },
        () => summon(pick(['windnase', 'wolkling', 'regentropf']))][m](); break;
      case 'madam_miesmohn': [
        () => spiral(ph2 ? 22 : 14),
        () => { emit(e.x, e.y, '#ff86c8', 16, 60, 2); e.bx = rnd(50, 130); e.move = 0; fan(ph2 ? 6 : 4, 66); },
        () => summon(pick(['clowni', 'popcorn', 'bluetenblob']))][m](); break;
      case 'kaiserin_kuller': [
        () => { rain(ph2 ? 6 : 4, 'shard'); if (ph3) spiral(12); },
        () => { fan(ph2 ? 7 : 5, 70); if (ph3) setTimeout(() => G.room === Rm && fan(5, 80), 500); },
        () => summon(pick(['kronenwaechter', 'ritterknolle', 'sternling']), ph2 ? 3 : 2)][m](); break;
    }
  }
  drawEnemy(e);
  e.sp.flash = e.fl > 0.3 ? 0.7 : e.telegraph && Math.floor(G.t * 10) % 2 ? 0.5 : 0;
  if (e.shellT > 0) e.sp.tint('#b8b0d0');
}
function shotHitsPlatform(s) {
  const Rm = G.room, plat = Rm.plat;
  if (PL().shield) { sfx.play('armor'); ring(s.x, PLAT_Y - 3, '#7fd6ef'); return; }
  if (lvl('dornen') && (lvl('dornen') >= 2 || Math.random() < 0.6)) {
    const tg = nearestEnemy(s.x, PLAT_Y); const r2 = shoot(s.x, PLAT_Y - 6, s.kind === 'ice' || s.kind === 'slime' || s.kind === 'zap' || s.kind === 'ink' || s.kind === 'rock' ? s.kind : 'seed', -s.vx * 0.4, -170, false, 2 * lvl('dornen'), tg);
    r2.sp.tint('#c9ffb0'); ring(s.x, PLAT_Y - 4, '#c9ffb0'); sfx.play('armor'); fx('dornen'); return;
  }
  emit(s.x, PLAT_Y, s.kind === 'slime' ? '#9be070' : s.kind === 'ice' ? '#bfefff' : '#a06a3c', 8, 40);
  if (s.kind === 'slime') { plat.slow = 2.5; sfx.play('stun'); return; }
  if (s.kind === 'ice') { plat.stun = 1.1; sfx.play('stun'); return; }
  if (s.kind === 'zap') { plat.stun = 0.7; sfx.play('zap'); emit(s.x, PLAT_Y, '#fff27a', 10, 50); return; }
  if (s.kind === 'ink') { Rm.ink = 2.6; sfx.play('stun'); return; }
  if (lvl('panzer')) { plat.blocks++; const blk = lvl('panzer') === 1 ? plat.blocks % 2 === 0 : plat.blocks % 3 !== 0; if (blk) { fx('panzer'); sfx.play('armor'); emit(s.x, PLAT_Y, '#c9cbd6', 8, 40); return; } }
  hurt(1, 'shot:' + s.kind);
}

// ---------------------------------------------------------------- Zielen & Skills
function launch(b, a) {
  const Rm = G.room; const S = speedOf(b);
  b.caught = false; b.vx = Math.cos(a) * S; b.vy = Math.sin(a) * S; b.y = PLAT_Y - b.r - 2;
  Rm.state = 'fly'; Rm.flightHits = 0; Rm.skillUses = 0; G.hint = '';
  sfx.play('launch'); emit(b.x, b.y + 4, '#fffcf0', 6, 30);
  if (lvl('zwilling') && Rm.balls.length < 8 && fx('zwilling')) spawnBall(false, b.x, b.y, Math.cos(a + 0.25) * S, Math.sin(a + 0.25) * S);
  if (Rm.firstShot) { Rm.firstShot = false; G.run.rooms === 0 && (G.hint = G.run.g.trig === 'tippen' ? 'Wischen = Plattform · Tippen = ' + EFFECTS[G.run.g.eff].name : 'Skill: ' + TRIGGERS[G.run.g.trig].text); setTimeout(() => (G.hint = ''), 2500); }
}
// Rückruf: Tippen genau dann, wenn die Murmel auf dem Rückweg die gestrichelte Linie kreuzt
function parryWin(b) { return 6 + speedOf(b) * 0.055; }
function tutTick(mb, Rm) {
  const T = (Rm.tut = Rm.tut || { step: 0, shown: 0 });
  if (T.step === 0 && Rm.state === 'fly') T.step = 1;
  if (T.step === 1 && mb && !mb.caught && mb.vy > 0 && Math.abs(mb.y - DANGER) < 22) { G.slow = 0.12; G.hint = 'JETZT TIPPEN!'; T.hintT = 0.6; }
  if (T.step === 1 && Rm.mom >= 1) { T.step = 2; banner('SCHWUNG! Je öfter, desto schneller', 1.6); }
  if (T.step >= 1 && !T.shot && Rm.shots.some((x) => x.red)) { T.shot = true; G.slow = 0.5; banner('Rote Kugeln: ausweichen!', 1.4); }
  if (T.hintT !== undefined) { T.hintT -= 1 / 60; if (T.hintT <= 0 && G.hint === 'JETZT TIPPEN!') G.hint = ''; }
}
function tryParry() {
  const Rm = G.room, b = Rm && mainBall();
  if (!b || b.caught || b.vy <= 0 || b.parried || Math.abs(b.y - DANGER) > parryWin(b)) return false;
  b.parried = true; b.boost = Math.max(b.boost, 0.4); buzz(12 + Math.min(12, Rm.mom) * 4);
  if (Rm.mom >= 5) G.slow = 0.22 + Math.min(12, Rm.mom) * 0.015;
  Rm.mom = Math.min(12, Math.floor(Rm.mom) + (PL().momx2 ? 2 : 1)); Rm.momT = 0;
  G.hitstop = Math.max(G.hitstop, 0.05); G.shake = Math.max(G.shake, 0.05 + 0.02 * Rm.mom);
  sfx.play('perfect', 1 + Rm.mom * 0.06); ring(b.x, b.y, '#ffd45c'); emit(b.x, b.y, '#ffd45c', 10 + Rm.mom * 2, 50 + Rm.mom * 6, 2);
  for (const d of dangerDots) d.material.color.set('#ffd45c');
  Rm.lineFlash = 0.25;
  banner(Rm.mom >= 12 ? 'MAXIMALER SCHWUNG!' : `SCHWUNG x${Rm.mom}`, 0.5);
  return true;
}
function useSkill(tx, ty) {
  const Rm = G.room, b = mainBall(); if (!b || b.caught) return;
  if (G.run.g.trig !== 'tippen') { G.hint = TRIGGERS[G.run.g.trig].text + ' – automatisch'; setTimeout(() => (G.hint = ''), 1200); return; }
  const max = 1 + lvl('akku'); if (Rm.skillUses >= max) { sfx.play('ui'); return; }
  Rm.skillUses++; if (Rm.skillUses === 2) fx('akku'); doEffect(b, tx, ty); if (rel('echo')) setTimeout(() => G.room === Rm && !b.dead && doEffect(b, tx, ty), 180);
}
function autoSkill(trig) { const b = G.room && mainBall(); if (b && !b.caught && G.run.g.trig === trig) { doEffect(b); if (rel('echo')) { const Rm = G.room; setTimeout(() => G.room === Rm && !b.dead && doEffect(b), 180); } } }
function doEffect(b, tx, ty) {
  const Rm = G.room; const g = G.run.g; const S = speedOf(b);
  b.skillAnim = 0.5; sfx.play('skill'); emit(b.x, b.y, ELEMENTS[g.els[0]].color, 12, 60, 2);
  switch (g.eff) {
    case 'schubs': { if (tx === undefined) { const t = nearestEnemy(b.x, b.y); tx = t ? t.x : 90; ty = t ? t.y : 60; } const a = Math.atan2(ty - b.y, tx - b.x); b.vx = Math.cos(a) * S; b.vy = Math.sin(a) * S; b.boost = 0.5; b.charge += 1; break; }
    case 'platsch': for (const d of [-0.6, 0.6]) { const a = Math.atan2(b.vy, b.vx) + d; if (Rm.balls.length < 9) spawnBall(false, b.x, b.y, Math.cos(a) * S, Math.sin(a) * S); } break;
    case 'ramme': b.vx = 0; b.vy = -S; b.ram = 0.9; break;
    case 'feder': b.vy = -Math.abs(b.vy) - 20; b.boost = 1.6; b.charge += 1; break;
    case 'nova': ring(b.x, b.y, ELEMENTS[g.els[0]].color); boom(b.x, b.y, 24, 2 + g.gen * 0.3, null); break;
    case 'strahl': for (let y = b.y; y > TOP; y -= 3) emit(b.x + rnd(-1, 1), y, pick(['#fffcf0', '#ffe48a']), 1, 6, 2, 0.3, { g: 0, up: 0 }); sfx.play('zap');
      for (const e of Rm.enemies) if (!e.dead && e.y < b.y && Math.abs(e.x - b.x) < e.r + 3) hitEnemy(e, null, 2.5 + g.gen * 0.3, 'shot'); break;
    case 'stern': for (let i = 0; i < 3; i++) { const tg = pick(Rm.enemies.filter((e) => !e.dead && !e.ghost)); const a = -Math.PI / 2 + (i - 1) * 0.5; shoot(b.x, b.y, 'star', Math.cos(a) * 140, Math.sin(a) * 140, false, 2, tg); } break;
    case 'kette': { let cur = b; const done = new Set(); for (let i = 0; i < 3; i++) { const t = Rm.enemies.filter((o) => !o.dead && !o.ghost && !done.has(o)).sort((p, q) => dist(p.x, p.y, cur.x, cur.y) - dist(q.x, q.y, cur.x, cur.y))[0]; if (!t) break; for (let s2 = 1; s2 < 6; s2++) emit(cur.x + (t.x - cur.x) * s2 / 6, cur.y + (t.y - cur.y) * s2 / 6, '#ffe14d', 1, 6, 1, 0.2, { g: 0 }); done.add(t); hitEnemy(t, null, 1.5 + g.gen * 0.2, 'chain'); cur = t; } sfx.play('zap'); break; }
  }
}
function aimDir(px, py, b) {
  let a = Math.atan2(py - b.y, px - b.x);
  if (a > 0) a = px < b.x ? -Math.PI + 0.25 : -0.25;
  return clamp(a, -Math.PI + 0.25, -0.25);
}
function aimUpdate() {
  const Rm = G.room; const b = Rm && mainBall();
  const show = Rm && b && b.caught && Rm.state === 'aim' && (Rm.aiming || G.keys.aimMode || G.auto);
  if (!show) { for (const d of aimDots) d.visible = false; return; }
  let x = b.x, y = b.y, vx = Math.cos(Rm.aimA), vy = Math.sin(Rm.aimA);
  let i = 0; const step = 5;
  for (let s = 0; s < 140 && i < aimDots.length; s += 1) {
    x += vx; y += vy;
    if (x < WALL + b.r) { x = WALL + b.r; vx = -vx; } if (x > LW - WALL - b.r) { x = LW - WALL - b.r; vx = -vx; }
    if (y < TOP + b.r) break;
    if (s % step === 0 && s > 6) { const d = aimDots[i++]; d.visible = true; placeRect(d, x, y, 1, 1); d.material.opacity = (Math.floor(G.t * 8) + i) % 3 === 0 ? 1 : 0.6; }
    let hitE = false; for (const e of Rm.enemies) if (!e.dead && !e.ghost && dist(x, y, e.x, e.y) < e.r + b.r - 1) { hitE = true; break; }
    if (hitE) break;
  }
  for (; i < aimDots.length; i++) aimDots[i].visible = false;
}

// ---------------------------------------------------------------- Eingabe
function toLocal(ev) { const r = renderer.domElement.getBoundingClientRect(); return [(ev.clientX - r.left) / r.width * LW, (ev.clientY - r.top) / r.height * LH]; }
renderer.domElement.addEventListener('pointerdown', (ev) => {
  sfx.unlock();
  if (G.mode !== 'play' || G.dialog) return;
  const [x, y] = toLocal(ev); const p = G.ptr; const Rm = G.room; const b = Rm && mainBall();
  p.down = true; p.x = p.sx = x; p.y = p.sy = y; p.t0 = performance.now(); p.moved = 0; p.lastX = x;
  renderer.domElement.setPointerCapture(ev.pointerId);
  if (b && b.caught && Rm.state === 'aim') {
    p.zone = y > PLAT_Y - 12 ? 'zaim' : 'aim'; Rm.aiming = true;
    if (p.zone === 'aim') Rm.aimA = aimDir(x, y, b); else { p.a0 = Rm.aimA || -Math.PI / 2; }
  } else p.zone = 'move';
});
renderer.domElement.addEventListener('pointermove', (ev) => {
  const p = G.ptr; if (!p.down || G.mode !== 'play') return;
  const [x, y] = toLocal(ev); const Rm = G.room; const b = Rm && mainBall();
  p.moved += Math.abs(x - p.x) + Math.abs(y - p.y);
  if (p.zone === 'aim' && b && b.caught) Rm.aimA = aimDir(x, y, b);
  else if (p.zone === 'zaim' && b && b.caught) Rm.aimA = clamp(p.a0 + (x - p.sx) * 0.035, -Math.PI + 0.25, -0.25);
  else if (Rm) Rm.plat.tx += (x - p.lastX) * (PL().fast ? 2 : 1.15);
  p.x = x; p.y = y; p.lastX = x;
});
const endPtr = (ev) => {
  const p = G.ptr; if (!p.down) return; p.down = false;
  if (G.mode !== 'play') return;
  const Rm = G.room; const b = Rm && mainBall();
  if ((p.zone === 'aim' || p.zone === 'zaim') && Rm.aiming && b && b.caught) { Rm.aiming = false; launch(b, Rm.aimA); return; }
  if (Rm) Rm.aiming = false;
  if (performance.now() - p.t0 < 260 && p.moved < 6 && b && !b.caught) { if (!tryParry()) useSkill(p.x, p.y); }
};
renderer.domElement.addEventListener('pointerup', endPtr);
renderer.domElement.addEventListener('pointercancel', endPtr);
addEventListener('keydown', (ev) => {
  G.keys[ev.key] = true; sfx.unlock();
  if (G.mode !== 'play' || G.dialog) return;
  const Rm = G.room, b = Rm && mainBall();
  if (ev.key === ' ' || ev.key === 'ArrowUp' || ev.key === 'w') {
    ev.preventDefault();
    if (b && b.caught && Rm.state === 'aim') { if (!G.keys.aimMode) { G.keys.aimMode = true; Rm.aimA = -Math.PI / 2; } else { G.keys.aimMode = false; launch(b, Rm.aimA); } }
    else if (!tryParry()) useSkill();
  }
  if (ev.key === 'Escape' || ev.key === 'p') openPause();
});
addEventListener('keyup', (ev) => { G.keys[ev.key] = false; });
function keyAim(dt) { const Rm = G.room; if (G.keys.aimMode && Rm) { const k = (G.keys.ArrowRight || G.keys.d ? 1 : 0) - (G.keys.ArrowLeft || G.keys.a ? 1 : 0); Rm.aimA = clamp(Rm.aimA + k * 1.6 * dt, -Math.PI + 0.25, -0.25); } }

// ---------------------------------------------------------------- Autopilot (Tests)
function botControl(dt) {
  const Rm = G.room, b = mainBall(); if (!b) return;
  // Geschossen ausweichen
  let danger = null; for (const s of Rm.shots) if (s.enemy && s.vy > 0 && s.y > 200 && s.kind !== 'rock') { const tt = (PLAT_Y - s.y) / s.vy; const xx = s.x + s.vx * tt; if (Math.abs(xx - Rm.plat.x) < Rm.plat.w / 2 + 4) danger = xx; }
  if (b.caught) {
    Rm.botT = (Rm.botT || 0) + dt;
    if (danger !== null) Rm.plat.tx = danger < 90 ? danger + 40 : danger - 40;
    if (Rm.botT > 0.35 && Rm.state === 'aim') { Rm.botT = 0; const t = pick(Rm.enemies.filter((e) => !e.ghost)) || { x: 90, y: 50 }; Rm.aimA = aimDir(t.x + rnd(-4, 4), t.y, b); launch(b, Rm.aimA); }
    return;
  }
  // Landepunkt und Landezeit schätzen
  let x = b.x, y = b.y, vx = b.vx, vy = b.vy, T = 0; const S = speedOf(b);
  for (let i = 0; i < 600 && !(vy > 0 && y >= PLAT_Y - b.r - 1); i++) { const h = 1 / 120; T += h; vy += GRAV * h; const v = Math.hypot(vx, vy); vx = vx / v * S; vy = vy / v * S; x += vx * h; y += vy * h; if (x < WALL + b.r) { x = WALL + b.r; vx = -vx; } if (x > LW - WALL - b.r) { x = LW - WALL - b.r; vx = -vx; } if (y < TOP + b.r) vy = Math.abs(vy); }
  // Bedrohungen, die vor der Murmel ankommen
  const half = Rm.plat.w / 2 + 5; let threat = null;
  for (const s of Rm.shots) { if (!s.enemy || s.vy <= 0 || s.kind === 'rock' && s.y < 40) continue; const ts = (PLAT_Y - s.y) / Math.max(20, s.vy); if (ts > 1.6) continue; const xs = s.x + s.vx * ts; if (ts < T - 0.15 && Math.abs(xs - Rm.plat.x) < half) threat = xs; }
  for (const e of Rm.enemies) if ((e.state === 'dive' || e.state === 'swoop' || e.state === 'warn') && Math.abs(e.x - Rm.plat.x) < half + 6) threat = e.x;
  if (threat !== null) { const l = threat - half - 4, r = threat + half + 4; Rm.plat.tx = (l > WALL + half && (Math.abs(l - x) < Math.abs(r - x) || r > LW - WALL - half)) ? l : r; }
  else { Rm.botOff = Rm.botOff ?? rnd(-10, 10); if (b.vy < 0) Rm.botOff = rnd(-12, 12); Rm.plat.tx = x + Rm.botOff; }
  if (b.vy > 0 && Math.abs(b.y - DANGER) < 4 && Math.random() < 0.5) tryParry(); else if (Math.random() < dt * 0.5) useSkill();
}

// ---------------------------------------------------------------- Belohnungen & Dialoge
function rollPU(n, min = 'common') {
  const kl = lvl('klee') + ws('glueck');
  const W = { common: 60, rare: 28 + kl * 10, epic: 10 + kl * 6, legendary: 3 + kl * 2, curse: 6 };
  const order = ['common', 'rare', 'epic', 'legendary'];
  const out = [];
  for (let i = 0; i < 40 && out.length < n; i++) {
    let cands = Object.keys(POWERUPS).filter((k) => lvl(k) < POWERUPS[k].max && !out.includes(k));
    if (min !== 'common') cands = cands.filter((k) => POWERUPS[k].r !== 'curse' && order.indexOf(POWERUPS[k].r) >= order.indexOf(min));
    if (!cands.length) break;
    const tot = cands.reduce((s, k) => s + W[POWERUPS[k].r], 0); let r = Math.random() * tot;
    for (const k of cands) { r -= W[POWERUPS[k].r]; if (r <= 0) { out.push(k); break; } }
  }
  return out;
}
// ===== Karten-UI-Bausteine
const UIC = (n) => `<img class="px" src="assets/ui/${n}.png">`;
const MIC = (n) => `<img class="px" src="assets/misc/${n}.png">`;
const chip = (icon, label, col = '#c9cbd6') => `<span class="chip" style="--cc:${col}">${icon}${label}</span>`;
const bdg = (icon, label, gold) => `<span class="bdg${gold ? ' gold' : ''}">${icon}${label}</span>`;
const segBar = (v, max, col, n = 10) => `<span class="bar" style="--bc:${col}">${Array.from({ length: n }, (_, i) => `<i class="${i < Math.round((v / max) * n) ? 'on' : ''}"></i>`).join('')}</span>`;
const lvPips = (L, max, isNew) => `<span class="lvp">${Array.from({ length: max }, (_, i) => `<i class="${i < L ? 'on' : i === L && isNew ? 'new' : ''}"></i>`).join('')}</span>`;
const rarBdg = (g) => { const R = RAR[rarOf(g)]; return `<span class="bdg rb" style="--rc:${R.color}">${R.name.toUpperCase()}</span>`; };
function gPortrait(g, sil = false) { return gCanvas(g, 16, 0, sil).toDataURL(); }
function marbleCard(g, o = {}) {
  const st = gStats(g), ec = ELEMENTS[g.els[0]].color;
  if (o.hidden) return `<div class="mc2" style="--mc:#8b8b9a;--ec:#6a5a80"><div class="mc2-top"><div class="mc2-por"><img src="${gPortrait(g, true)}"></div><div><div class="mc2-name">???</div><div class="badges">${o.hint || ''}</div></div></div>${o.chips ? `<div class="chips">${o.chips}</div>` : ''}</div>`;
  const els = g.els.map((e) => chip(UIC('el_' + e), ELEMENTS[e].name, ELEMENTS[e].color)).join('') + (g.els.length > 1 ? chip(UIC('st_mut'), elementName(g.els), '#ffd45c') : '');
  return `<div class="mc2" style="--mc:${g.col};--ec:${ec}">
    <div class="mc2-top"><div class="mc2-por"><img src="${gPortrait(g)}"></div>
      <div><div class="mc2-name">${g.name}</div><div class="mc2-stars">${starStr(g)}</div>
      <div class="badges">${rarBdg(g)}${g.gen ? bdg(UIC('st_gen'), 'GEN ' + g.gen) : ''}${g.q !== undefined ? bdg(UIC('st_level'), 'WURF ' + g.q + '%') : ''}${g.mut ? bdg(UIC('st_mut'), MUTATIONS[g.mut].name.toUpperCase(), true) : ''}${o.badge || ''}</div></div></div>
    <div class="chips">${els}</div>
    <div class="skillbox"><span class="ib">${UIC('tr_' + g.trig)}</span><span class="arr">›</span><span class="ib">${UIC('ef_' + g.eff)}</span><span class="sk"><b>${EFFECTS[g.eff].name}</b><small>${TRIGGERS[g.trig].text}: ${EFFECTS[g.eff].text}</small></span></div>
    <div class="srows">
      <div class="srow">${MIC('heart')}<span class="lab">Herzen</span><span class="hearts">${MIC('heart').repeat(Math.min(10, st.hearts))}</span></div>
      <div class="srow">${UIC('st_dmg')}<span class="lab">Schaden</span>${segBar(st.dmg, 3, '#ff5a6e')}<span class="val">${st.dmg}</span></div>
      <div class="srow">${UIC('st_tempo')}<span class="lab">Tempo</span>${segBar(st.speed - 0.6, 0.7, '#6fd0f0')}<span class="val">${Math.round(st.speed * 100)}%</span></div>
    </div>${g.mut ? `<div class="chips">${chip(UIC('st_mut'), MUTATIONS[g.mut].text, '#ffd45c')}</div>` : ''}${o.extra || ''}</div>`;
}
function uCard(o) {
  return `<div class="pc2" style="--rc:${o.color}"><div class="pc2-ic"><img class="px" src="${o.icon}"></div><div class="pc2-b"><div class="pc2-t"><span class="pc2-n">${o.title}</span>${o.tag ? `<span class="rtag">${o.tag}</span>` : ''}</div>${o.pips || ''}${o.text ? `<div class="pc2-x">${o.text}</div>` : ''}${o.after || ''}</div>${o.price !== undefined ? `<div class="pc2-p">${o.price}</div>` : ''}</div>`;
}
function tiles(list) { return `<div class="tiles3">${list.map((t) => `<div class="st3${t.wide ? ' wide' : ''}">${t.ic}<b>${t.v}</b><span>${t.l}</span></div>`).join('')}</div>`; }
function puCard(k, extra = {}) {
  const p = POWERUPS[k], L = lvl(k), rr = RARITY[p.r];
  const sy = synergiesFor(k).map((x) => `<span class="syn">${MIC('../icons/' + (x.a === k ? x.b : x.a))}SYNERGIE: ${x.name.toUpperCase()}</span>`).join('');
  const price = extra.price === undefined ? undefined : typeof extra.price === 'number' ? `${extra.price}${MIC('coin')}` : extra.price;
  return { ...extra, color: rr.color, html: uCard({ icon: `assets/icons/${k}.png`, color: rr.color, title: p.name, tag: L ? 'STUFE ' + (L + 1) : rr.name.toUpperCase(), pips: lvPips(L, p.max, true), text: p.text[0], after: sy, price }) };
}
function applyPU(k) {
  const R = G.run; const newSyn = synergiesFor(k); R.pu[k] = (R.pu[k] || 0) + 1; if (!R.order.includes(k)) R.order.push(k);
  if (newSyn.length) setTimeout(() => banner('SYNERGIE: ' + newSyn[0].name.toUpperCase(), 1.4), 50);
  if (k === 'herz') { R.maxHearts++; R.hearts = R.maxHearts; }
  if (k === 'glaskanone') { R.maxHearts = Math.max(1, R.maxHearts - 2); R.hearts = Math.min(R.hearts, R.maxHearts); }
  if (k === 'blutpreis') { R.coins += 120; R.maxHearts = Math.max(1, R.maxHearts - 1); R.hearts = Math.min(R.hearts, R.maxHearts); }
  sfx.play('pickup'); updateHud();
}
function puChoice(head, sub, min, then) {
  const ks = rollPU(3 + lvl('wuerfel') + (rel('klee') ? 1 : 0), min);
  if (!ks.length) { R_coins(25); return then(); }
  const btns = [{ label: 'Überspringen (+10)', cls: 'gray', fn: () => { R_coins(10); closeDialog(); then(); } }];
  if (G.run.rerolls > 0) btns.unshift({ label: `Neu würfeln (${G.run.rerolls})`, cls: 'alt', fn: () => { G.run.rerolls--; closeDialog(); puChoice(head, sub, min, then); } });
  openDialog({ head, sub, cards: ks.map((k) => puCard(k, { fn: () => { applyPU(k); closeDialog(); then(); } })), buttons: btns });
}
function R_coins(n) { G.run.coins += n; updateHud(); }

function roomDone() {
  const Rm = G.room, R = G.run; if (Rm.done) return; Rm.done = true; const RmEv = Rm;
  if (!save.tut && !G.auto) { save.tut = true; persist(); }
  R.rooms++;
  const t = Rm.type;
  if (lvl('lebensfrucht')) { heal(lvl('lebensfrucht')); fx('lebensfrucht'); }
  if (R.g.mut === 'schimmernd') R.glanz++;
  if (RmEv.ev === 'kernjagd') R.cores++;
  if (lvl('zinsen')) { fx('zinsen'); const z = Math.min(30 * lvl('zinsen'), Math.floor(R.coins * 0.1 * lvl('zinsen'))); R.coins += z; }
  clearRoom(); setMode('map'); mapCv.style.display = 'block';
  if (t === 'boss') { R.glanz += 5; return relicChoice('Boss besiegt!', finishNode); }
  if (t === 'elite' && Math.random() < 0.25) { R.glanz += 1; return relicChoice('Elite besiegt!', finishNode); }
  if (t === 'elite') { R.glanz += 1; puChoice('Elite besiegt!', '+1 Glanz · Wähle ein seltenes Power-up', 'rare', finishNode); }
  else if (t === 'sonder') puChoice('Event geschafft!', 'Wähle ein besonderes Power-up', RmEv.ev === 'muenzregen' ? 'common' : RmEv.ev === 'ansturm' ? 'epic' : 'rare', finishNode);
  else puChoice('Raum geschafft!', 'Wähle 1 von 3 Power-ups', 'common', finishNode);
}
const PRICE = { common: 30, rare: 50, epic: 80, legendary: 110, curse: 15 };
const priceAdd = () => G.run.floor * 3 + CH() * 12;
const relPrice = (p) => Math.round(p * (rel('gier') ? 1.3 : 1));
function openShop() {
  const R = G.run; const ks = rollPU(4); const sold = new Set(); let healBought = 0;
  const render = () => openDialog({ head: 'Laden', tiles: [{ ic: MIC('coin'), v: R.coins, l: 'Münzen' }, { ic: MIC('heart'), v: `${R.hearts}/${R.maxHearts}`, l: 'Herzen' }, { ic: UIC('st_pu'), v: R.order.length, l: 'Power-ups' }], cards: [
    ...ks.map((k) => { const pr = relPrice((PRICE[POWERUPS[k].r] + priceAdd()) * (1 - 0.1 * ws('rabatt'))); return puCard(k, { price: sold.has(k) ? 'Verkauft' : pr, dis: sold.has(k) || R.coins < pr, fn: () => { R.coins -= pr; sold.add(k); applyPU(k); render(); } }); }),
    { html: uCard({ icon: 'assets/misc/heart.png', color: '#ff5a6e', title: 'Herz auffüllen', tag: 'HEILUNG', text: `+1 Herz (${R.hearts}/${R.maxHearts})`, price: `20${MIC('coin')}` }), dis: R.coins < 20 || R.hearts >= R.maxHearts || healBought >= 3, fn: () => { R.coins -= 20; healBought++; heal(1); render(); } },
  ], buttons: [{ label: 'Weiter', fn: () => { closeDialog(); finishNode(); } }] });
  render();
}
function openRest() {
  const R = G.run; const up = R.order.filter((k) => lvl(k) < POWERUPS[k].max && POWERUPS[k].r !== 'curse');
  openDialog({ head: 'Rastplatz', text: `<div class="biome"><img class="px" src="assets/map/rast.png" style="width:calc(var(--u)*32);height:calc(var(--u)*32)"><div class="small">Ein warmes Feuer knistert.</div></div>`, cards: [
    { html: uCard({ icon: 'assets/map/rast.png', color: '#ff9a4a', title: 'Ausruhen', tag: 'HEILUNG', text: `+3 Herzen · jetzt ${R.hearts}/${R.maxHearts}`, after: `<span class="hearts">${MIC('heart').repeat(3)}</span>` }), fn: () => { heal(3); closeDialog(); finishNode(); } },
    { html: uCard({ icon: 'assets/ui/i_werk.png', color: '#ffd45c', title: 'Schmieden', tag: 'VERBESSERN', text: up.length ? 'Ein Power-up um 1 Stufe verbessern.' : 'Du hast nichts zum Verbessern.' }), dis: !up.length, fn: () => {
      openDialog({ head: 'Schmieden', sub: 'Was soll stärker werden?', cards: shuffle(up).slice(0, 3).map((k) => puCard(k, { fn: () => { applyPU(k); closeDialog(); finishNode(); } })), buttons: [] });
    } },
  ], buttons: [] });
}
function openEvent() {
  const R = G.run, ev = pick(EVENTS);
  const done = (msg) => { openDialog({ head: ev.title, text: `<div class="biome"><img class="px" src="assets/map/ereignis.png" style="width:calc(var(--u)*24);height:calc(var(--u)*24)"><div class="u">${msg}</div></div>`, buttons: [{ label: 'Weiter', fn: () => { closeDialog(); finishNode(); } }] }); };
  const act = {
    none: () => done('Du gehst weiter.'),
    hurt_pick: () => { R.hearts = Math.max(1, R.hearts - 1); updateHud(); puChoice('Tausch', 'Der Pilz kichert.', 'rare', finishNode); },
    well: () => { R.coins += 35; if (Math.random() < 0.4) { R.hearts = Math.max(1, R.hearts - 1); done('+35 Münzen … aber etwas hat dich gebissen! (−1 Herz)'); } else done('+35 Münzen!'); updateHud(); },
    wish: () => { if (R.coins >= 10) { R.coins -= 10; heal(1); done('Plätscher. Du fühlst dich besser. (+1 Herz)'); } else done('Du hast keine Münze …'); },
    bag: () => { const r = Math.random(); if (r < 0.5) { R.coins += 40; updateHud(); done('+40 Münzen!'); } else if (r < 0.8) puChoice('Fundstück', 'Im Rucksack liegt etwas Nützliches.', 'common', finishNode); else done('Leer … nur Krümel.'); },
    heal_full: () => { R.hearts = R.maxHearts; updateHud(); sfx.play('pickup'); done('Volle Heilung!'); },
    sacrifice: () => { R.hearts = Math.max(1, R.hearts - 2); updateHud(); puChoice('Opfergabe', 'Der Schrein leuchtet.', 'epic', finishNode); },
  };
  const EVI = { none: 'ui/i_back', hurt_pick: 'icons/herz', well: 'misc/coin', wish: 'misc/heart', bag: 'ui/st_pu', heal_full: 'icons/lebensfrucht', sacrifice: 'icons/blutpreis' };
  openDialog({ head: ev.title, text: `<div class="biome"><img class="px" src="assets/map/ereignis.png" style="width:calc(var(--u)*32);height:calc(var(--u)*32)"><div class="small">${ev.text}</div></div>`, cards: ev.choices.map((c) => ({ html: uCard({ icon: `assets/${EVI[c.act]}.png`, color: '#6fd0f0', title: c.label.split(' (')[0], text: c.label.includes('(') ? c.label.slice(c.label.indexOf('(') + 1, -1) : '' }), fn: () => act[c.act]() })), buttons: [] });
}

function openDialog(o) {
  G.dialog = o; const el = $('msg');
  $('msgHead').textContent = o.head || ''; $('overlayText').innerHTML = (o.sub ? `<div class="small" style="opacity:.85">${o.sub}</div>` : '') + (o.text || '') + (o.tiles ? tiles(o.tiles) : '');
  $('msgStats').innerHTML = o.stats || '';
  if (o.mount) o.mount($('overlayText'));
  const cards = $('msgCards'); cards.innerHTML = '';
  for (const c of o.cards || []) {
    const d = document.createElement('div'); d.className = 'card' + (c.html ? ' raw' : '') + (c.dis ? ' dis' : ''); d.style.setProperty('--c', c.color || '#c9cbd6');
    if (c.html) d.innerHTML = c.html; else d.innerHTML = `${c.icon ? `<img class="px" src="${c.icon}">` : ''}<div><div class="u t">${c.title}</div>${c.rar ? `<div class="r">${c.rar}</div>` : ''}${c.text ? `<div class="small">${c.text}</div>` : ''}</div>${c.price !== undefined ? `<div class="price small">${typeof c.price === 'number' ? c.price + ' ' + IC('coin') : c.price}</div>` : ''}`;
    d.onclick = () => { if (!c.dis) { sfx.play('ui'); c.fn(); } };
    cards.appendChild(d);
  }
  const row = $('msgRow'); row.innerHTML = '';
  for (const b of o.buttons || []) { const bt = document.createElement('button'); bt.className = 'btn ' + (b.cls || ''); bt.textContent = b.label; if (b.icon) { bt.classList.add('ico'); bt.innerHTML = `<img class="px" src="assets/ui/${b.icon}.png">`; } if (b.glanz) bt.insertAdjacentHTML('beforeend', ' <img class="bi px" src="assets/misc/glanz.png">'); bt.onclick = () => { sfx.play('ui'); b.fn(); }; row.appendChild(bt); }
  el.classList.add('on');
  if (G.auto && !o.noAuto) setTimeout(() => { if (G.dialog !== o) return; const ok = (o.cards || []).filter((c) => !c.dis); if (ok.length && !o.shop) pick(ok).fn(); else if (o.buttons && o.buttons.length) o.buttons[o.buttons.length - 1].fn(); }, 20);
}
function closeDialog() { G.dialog = null; $('msg').classList.remove('on'); }

function openPause() {
  if (G.mode !== 'play' || G.dialog) return;
  G.paused = true;
  openDialog({ head: 'Pause', noAuto: true, tiles: runTiles(), buttons: [
    { label: '', icon: save.sound ? 'i_sound' : 'i_mute', cls: 'gray', fn: () => { save.sound = !save.sound; persist(); applySound(); closeDialog(); G.paused = false; openPause(); } },
    { label: '', icon: save.vib !== false ? 'i_vib' : 'i_novib', cls: 'gray', fn: () => { save.vib = save.vib === false; persist(); buzz(30); closeDialog(); G.paused = false; openPause(); } },
    { label: 'Aufgeben', cls: 'gray', fn: () => { closeDialog(); G.paused = false; G.run.hearts = 0; gameOver(); } },
    { label: 'Weiter', fn: () => { closeDialog(); G.paused = false; } },
  ] });
}
$('pauseBtn').onclick = () => (G.mode === 'map' ? null : openPause());
function applySound() { sfx.sfxOn = save.sound; sfx.setMusic(save.sound); }
function runTiles(extra = []) {
  const R = G.run; if (!R) return [];
  const sy = SYNERGIES.filter((x) => syn(x.id));
  const t = [
    { ic: `<img class="px" src="${gPortrait(R.g)}">`, v: R.g.name, l: 'Murmel' },
    { ic: UIC('st_level'), v: `${GL() + 1}/60`, l: BIO().name },
    { ic: UIC('st_kill'), v: R.kills, l: 'Besiegt' },
    { ic: UIC('st_pu'), v: Object.values(R.pu).reduce((a, b) => a + b, 0), l: 'Power-ups' },
    { ic: MIC('coin'), v: R.coins, l: 'Münzen' },
    { ic: MIC('heart'), v: `${Math.max(0, R.hearts)}/${R.maxHearts}`, l: 'Herzen' },
    ...(Object.keys(R.rel || {}).length ? [{ wide: true, ic: '', v: '', l: `<span class="relrow">${Object.keys(R.rel).map((k) => `<img class="px" title="${RELICS[k].name}" src="assets/relics/${k}.png">`).join('')}</span>Relikte` }] : []),
    ...extra,
  ];
  if (sy.length) t.push({ wide: true, ic: '', v: '', l: `<span class="chips">${sy.map((x) => chip(MIC('../icons/' + x.a), x.name, '#ffd45c')).join('')}</span>` });
  return t;
}
function runStats() { return ''; }
function rewardTiles(g) { const R = G.run; return [{ ic: MIC('glanz'), v: '+' + g, l: 'Glanz' }, { ic: MIC('kern'), v: '+' + R.cores, l: 'Kerne' }, { ic: UIC('st_ei'), v: R.hatched ? R.hatched.length : 0, l: R.hatched && R.hatched.length ? R.hatched.join(', ') : 'Eier' }]; }
function endRun(win) {
  const R = G.run; if (R.ended) return R.ended; const fl = GL();
  const g = R.glanz + fl + 2 + (win ? 25 : 0);
  save.glanz += g; save.cores += R.cores; save.best = Math.max(save.best, fl); if (win) save.wins++;
  R.hatched = []; for (let i = 0; i < R.eggs; i++) { const m = gachaRoll(1); addInv(m); save.unlocked[m.key] = true; R.hatched.push(m.name); }
  if (R.daily) dailyResult(fl, R.kills, win);
  persist(); R.ended = g; return g;
}
function gameOver() {
  if (!G.run || G.mode === 'over') return;
  clearRoom(); setMode('over'); sfx.stopMusic(); sfx.play('gameover');
  const g = endRun(false);
  openDialog({ head: 'Run vorbei', sub: 'Die Murmel ist erschöpft.', tiles: runTiles(rewardTiles(g)), noAuto: true, buttons: [
    { label: 'Menü', cls: 'gray', fn: () => { closeDialog(); showTitle(); } },
    { label: 'Nochmal', fn: () => { closeDialog(); newRun(G.run.g); } },
  ] });
  G.lastResult = { win: false, floor: GL(), kills: G.run.kills, glanz: g };
}
function victory() {
  setMode('over'); sfx.play('win');
  const g = endRun(true);
  openDialog({ head: 'Alle Biome befreit!', sub: 'Kaiserin Kuller ist besiegt.', tiles: runTiles(rewardTiles(g)), noAuto: true, buttons: [
    { label: 'Menü', fn: () => { closeDialog(); showTitle(); } },
  ] });
  G.lastResult = { win: true, floor: GL(), kills: G.run.kills, glanz: g };
}

// ---------------------------------------------------------------- HUD
function bumpHud() { const e = $('hCoins'); e.style.color = '#ffd45c'; clearTimeout(e._t); e._t = setTimeout(() => (e.style.color = ''), 120); }
function updateHud() {
  const R = G.run; if (!R) return;
  const h = $('hearts'); let s = '';
  for (let i = 0; i < R.maxHearts; i++) s += `<img class="px${i < R.hearts ? '' : ' empty'}" src="assets/misc/heart.png">`;
  h.innerHTML = s;
  $('hCoins').textContent = R.coins; $('hFloor').textContent = `${R.chapter + 1}-${(R.pending || R.node || { r: 0 }).r + 1}`;
}
function buildPuBar() {
  const R = G.run; const ks = R.order.slice(-16); $('puBar').innerHTML = (R.order.length > 16 ? `<i>+${R.order.length - 16}</i>` : '') + ks.map((k) => `<div><img class="px" src="assets/icons/${k}.png">${R.pu[k] > 1 ? `<b>${R.pu[k]}</b>` : ''}</div>`).join('');
}
let bannerT = 0;
function banner(txt, dur = 1) { const b = $('banner'); b.textContent = txt; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); bannerT = dur; }
function comboText(n) { if (n === 3 || n === 5 || n === 8 || n % 5 === 0) banner(`${n}er KOMBO!`, 0.6); }

// ---------------------------------------------------------------- Titel
const titleGroup = new THREE.Group(); scene.add(titleGroup);
const titleSprites = [];
const demo = { en: [], ball: null, plat: null };
function buildTitle() {
  quad(bgCache[0], 0, 0, LW, LH, 0, titleGroup);
  const ks = ['huepfer', 'knuffel', 'wackler', 'blubbser', 'bluetenblob', 'sternling', 'keksquell', 'propelli', 'geisti', 'zuckerwatte', 'seestern', 'windnase'];
  for (let i = 0; i < 9; i++) { const k = ks[i]; const s = new Sprite(`assets/enemies/${k}.png`, 16, 16, 4, { z: 5, parent: titleGroup }); demo.en.push({ sp: s, k, x: 26 + (i % 5) * 32 + (i >= 5 ? 16 : 0), y: 84 + (i >= 5 ? 18 : 0), alive: true, t: rnd(0, 3), rt: 0 }); }
  demo.plat = new Sprite('assets/biomes/hain/platform.png', 40, 12, 3, { z: 6, parent: titleGroup });
  demo.ball = { x: 90, y: 180, vx: 70, vy: -120, sp: null, key: null };
}
const KAL = ['#ffd45c', '#ff86c8', '#6fd0f0', '#8fd16a', '#c08bff'];
let kalT = 0;
function zoneFx(dt) {
  kalT -= dt; if (kalT > 0) return; const zy = PLAT_Y + 17, p = G.ptr;
  const finger = p.down && p.y > zy - 4;
  kalT = finger ? 0.025 : 0.06;
  const cx = finger ? clamp(p.x, WALL + 6, LW - WALL - 6) : 90, cy = finger ? clamp(p.y, zy + 5, LH - 5) : zy + (LH - zy) / 2;
  const t = G.t;
  const rings = finger ? [[6, 10 + Math.sin(t * 8) * 3, 3.2], [6, 5 + Math.sin(t * 11) * 2, -4.5]] : [[8, 14 + Math.sin(t * 1.3) * 7, 0.6], [6, 7 + Math.sin(t * 1.9) * 3, -0.9], [4, 22 + Math.sin(t * 0.8) * 5, 0.35]];
  rings.forEach(([n, r, sp], ri) => {
    for (let i = 0; i < n; i++) {
      const a = t * sp + i * Math.PI * 2 / n + ri * 0.4;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * (finger ? 0.8 : 0.5);
      if (y < zy + 1 || y > LH - 1) continue;
      const col = KAL[(i + ri + Math.floor(t * (finger ? 5 : 1.2))) % KAL.length];
      emit(x, y, col, 1, finger ? 26 : 6, ri === 0 && finger ? 2 : 1, finger ? 0.32 : 0.75, { angle: a + (finger ? 0.5 : Math.PI / 2), spread: 0.1, g: 0, up: 0, drag: 3 });
    }
  });
  if (finger) { emit(cx, cy, '#fffcf0', 2, 8, 2, 0.22, { g: 0, up: 0 }); if (Math.abs(p.x - (G.kalLX ?? p.x)) > 1) emit(cx, cy, KAL[Math.floor(t * 8) % KAL.length], 3, 14, 1, 0.4, { g: 0, up: 0 }); G.kalLX = p.x; }
}
function demoTick(dt) {
  const d = demo, b = d.ball; const g = selItem() ? selItem().g : BASE_BY.nib;
  const pid = save.platSel || 'moos'; if (d.pid !== pid) { d.plat.remove(); const P = PLAT_BY[pid]; d.plat = new Sprite(`assets/plat/${pid}.png`, P.w, 12, 3, { z: 6, parent: titleGroup }); d.pid = pid; }
  if (b.key !== g.id) { if (b.sp) b.sp.remove(); b.sp = new Sprite(gTex(g), 16, 16, 14, { z: 7, parent: titleGroup }); b.key = g.id; }
  b.vy += 60 * dt; const v = Math.hypot(b.vx, b.vy); b.vx = b.vx / v * 135; b.vy = b.vy / v * 135;
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.x < 14) { b.x = 14; b.vx = Math.abs(b.vx); } if (b.x > 166) { b.x = 166; b.vx = -Math.abs(b.vx); } if (b.y < 70) { b.y = 70; b.vy = Math.abs(b.vy); }
  const py = 196; d.px = (d.px ?? 90) + clamp(b.x - (d.px ?? 90), -120 * dt, 120 * dt);
  if (b.vy > 0 && b.y > py - 7 && b.y < py && Math.abs(b.x - d.px) < 22) { const off = (b.x - d.px) / 20; const a = -Math.PI / 2 + off * 0.9 + rnd(-0.2, 0.2); b.vx = Math.cos(a) * 135; b.vy = Math.sin(a) * 135; d.sq = 0.12; }
  if (b.y > 240) { b.x = d.px; b.y = py - 8; b.vy = -120; }
  for (const e of d.en) {
    e.t += dt;
    if (!e.alive) { e.rt -= dt; if (e.rt <= 0) { e.alive = true; e.sp.visible = true; } continue; }
    if (dist(b.x, b.y, e.x, e.y) < 13) { const nx = (b.x - e.x) / 13, ny = (b.y - e.y) / 13; const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; } e.alive = false; e.sp.visible = false; e.rt = 3; emit(e.x, e.y, '#fffcf0', 10, 60, 2); emit(e.x, e.y, '#ff8fa8', 6, 40); }
    e.sp.setFrame([0, 1, 0, 2, 0, 3][Math.floor(e.t * 6) % 6]); e.sp.at(e.x + Math.sin(e.t * 1.2) * 4, e.y);
  }
  d.sq = (d.sq || 0) - dt; d.plat.setFrame(d.sq > 0 ? 2 : 0); d.plat.at(d.px, py + 4);
  b.sp.setFrame(4 + (Math.floor(G.t * 10) % 4)); b.sp.at(b.x, b.y - 1);
  if (Math.random() < dt * 30) emit(b.x, b.y, '#fffcf0', 1, 4, 1, 0.25, { g: 0, up: 0 });
}
function gCanvas(g, px = 16, frame = 0, silhouette = false) {
  const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
  const im = gImg(g); x.drawImage(im, frame * 16, 0, 16, 16, 0, 0, 16, 16);
  if (silhouette) { x.globalCompositeOperation = 'source-in'; x.fillStyle = '#2b1d3a'; x.fillRect(0, 0, 16, 16); }
  return c;
}
const IC = (n) => `<img class="px ic" src="assets/misc/${n}.png">`;
const starStr = (g) => IC('star_on').repeat(stars(g)) + IC('star_off').repeat(5 - stars(g));
function elHtml(g) { return g.els.map((e) => `<span style="color:${ELEMENTS[e].color}">${ELEMENTS[e].name}</span>`).join(' + ') + (g.els.length > 1 ? ` = <b>${elementName(g.els)}</b>` : ''); }
function gInfoHtml(g) {
  const st = gStats(g);
  return `<div class="u" style="color:${g.col}">${g.name} <span class="small" style="color:#ffd45c">${starStr(g)}</span></div>
  <div class="small">${g.gen ? 'Generation ' + g.gen : 'Grundmurmel'}${g.mut ? ' · <b>' + MUTATIONS[g.mut].name + '</b>' : ''}</div>
  <div class="small">Element: ${elHtml(g)}</div>
  <div class="small">Skill <b>${EFFECTS[g.eff].name}</b>: ${skillText(g)}</div>
  <div class="small" style="opacity:.85">Herzen ${st.hearts} · Schaden ${st.dmg} · Tempo ${Math.round(st.speed * 100)} %</div>` + (g.mut ? `<div class="small" style="opacity:.85">${MUTATIONS[g.mut].text}</div>` : '') + (g.parents ? `<div class="small" style="opacity:.6">aus ${g.parents.join(' + ')}</div>` : '');
}
function showTitle() {
  Math.random = realRandom;
  clearRoom(); G.run = null; setMode('title'); closeDialog(); initMeta(); persist();
  sfx.startMusic(0, false);
  if (!$('logo').children.length) $('logo').innerHTML = [...'BOUNCEYARD'].map((c, i) => `<img src="assets/ui/logo_${c}.png" style="animation-delay:${i * 0.08}s">`).join('');
  const it = selItem(); const sn = $('selName'); sn.innerHTML = ''; const c = gCanvas(it.g); c.style.cssText = 'width:calc(var(--u)*10);height:calc(var(--u)*10);image-rendering:pixelated'; sn.appendChild(c);
  sn.insertAdjacentHTML('beforeend', `<span style="color:${it.g.col}">${it.g.name}</span><span>${starStr(it.g)}</span><span style="opacity:.6">+</span>${platImg(PLAT_BY[save.platSel] || PLAT_BY.moos, 0.5)}`); sn.onclick = () => openKiste();
  $('tGlanz').textContent = save.glanz; $('tKern').textContent = save.cores; $('tBest').textContent = save.best ? `Rekord ${save.best}/60` : '';
  $('bSound').querySelector('img').src = `assets/ui/i_${save.sound ? 'sound' : 'mute'}.png`;
  $('bVib').querySelector('img').src = `assets/ui/i_${save.vib !== false ? 'vib' : 'novib'}.png`;
}
function grid(list, onPick, selU, offFn) {
  const wrap = document.createElement('div'); wrap.className = 'mgrid';
  list.forEach((x) => {
    const g = x.g || x; const d = document.createElement('div');
    d.className = 'tile' + (x.uid && x.uid === selU ? ' sel' : '') + (offFn && offFn(x) ? ' off' : '');
    if (!x.hidden) d.style.borderColor = RAR[rarOf(g)].color;
    d.appendChild(gCanvas(g, 16, 0, x.hidden));
    d.insertAdjacentHTML('beforeend', `<div class="n">${x.hidden ? '???' : g.name}</div><div class="st">${x.price ? x.price : x.hidden ? '' : starStr(g)}</div>${x.tag ? `<div class="tag">${x.tag}</div>` : ''}`);
    d.onclick = () => { sfx.play('ui'); onPick(x); };
    wrap.appendChild(d);
  });
  return wrap;
}
function openKiste() {
  openDialog({ head: 'Murmelkiste', noAuto: true, mount: (el) => {
    el.insertAdjacentHTML('beforeend', marbleCard(selItem().g, { badge: bdg(UIC('i_kiste'), save.inv.length + ' IN DER KISTE') }));
    el.appendChild(grid(save.inv.slice().sort((a, b) => b.g.gen - a.g.gen || stars(b.g) - stars(a.g)), (x) => { save.selU = x.uid; persist(); openKiste(); }, save.selU));
  }, buttons: [{ label: 'Fertig', fn: () => { closeDialog(); showTitle(); } }] });
}
let shopSel = 0, shopTab = 'm', platSel = 0;
function shopTabs(el) {
  const t = document.createElement('div'); t.className = 'tabs';
  t.innerHTML = `<button class="tab${shopTab === 'm' ? ' on' : ''}">${UIC('i_kiste')}Automat</button><button class="tab${shopTab === 'p' ? ' on' : ''}"><img class="px" src="assets/plat/moos.png" style="width:calc(var(--u)*14);height:calc(var(--u)*4.2);object-fit:cover;object-position:0 0">Plattformen</button>`;
  t.children[0].onclick = () => { shopTab = 'm'; sfx.play('ui'); openMarbleShop(); }; t.children[1].onclick = () => { shopTab = 'p'; sfx.play('ui'); openMarbleShop(); };
  el.appendChild(t);
}
function platImg(P, scale = 1) { return `<span class="pimg" style="width:calc(var(--u)*${P.w * scale});height:calc(var(--u)*${12 * scale});background-image:url(assets/plat/${P.id}.png)"></span>`; }
function openPlatShop() {
  const P = PLATFORMS[platSel]; const own = save.plats[P.id]; const eq = save.platSel === P.id;
  const mods = [P.w !== 32 ? chip(UIC('st_level'), 'Breite ' + P.w, '#c9cbd6') : '', P.speed ? chip(UIC('st_tempo'), 'Tempo ' + Math.round(P.speed * 100) + '%', '#6fd0f0') : '', P.dmg ? chip(UIC('st_dmg'), 'Schaden ' + Math.round(P.dmg * 100) + '%', P.dmg >= 1 ? '#8fd16a' : '#ff5a6e') : ''].join('');
  openDialog({ head: 'Laden', sub: `${IC('glanz')} ${save.glanz} Glanz`, noAuto: true, mount: (el) => {
    shopTabs(el);
    el.insertAdjacentHTML('beforeend', `<div class="show"><div class="pstage">${platImg(P, 2.4)}</div>${uCard({ icon: `assets/plat/${P.id}.png`, color: own ? P.col : '#8b8b9a', title: P.name, tag: eq ? 'AUSGERÜSTET' : own ? 'BESITZT DU' : P.cost + ' GLANZ', text: P.text, after: mods ? `<span class="chips">${mods}</span>` : '' })}</div>`);
    const strip = document.createElement('div'); strip.className = 'strip';
    PLATFORMS.forEach((q, i) => { const d = document.createElement('div'); d.className = 'tile' + (i === platSel ? ' sel' : '') + (!save.plats[q.id] ? ' off' : ''); d.innerHTML = `<div class="ptile">${platImg(q, 0.62)}</div><div class="n">${q.name}</div>` + (!save.plats[q.id] ? '<img class="lk2 px" src="assets/ui/i_lock.png">' : save.platSel === q.id ? '<img class="lk2 px" src="assets/ui/st_mut.png">' : ''); d.onclick = () => { platSel = i; sfx.play('ui'); openPlatShop(); }; strip.appendChild(d); });
    el.appendChild(strip); requestAnimationFrame(() => { const t = strip.children[platSel]; if (t) strip.scrollLeft = t.offsetLeft - strip.clientWidth / 2 + t.clientWidth / 2; });
  }, buttons: [
    { label: 'Zurück', cls: 'gray', fn: () => { closeDialog(); showTitle(); } },
    own ? { label: eq ? 'Ausgerüstet' : 'Ausrüsten', cls: eq ? 'gray' : '', fn: () => { save.platSel = P.id; persist(); sfx.play('pickup'); openPlatShop(); } }
        : { label: `Freischalten · ${P.cost}`, glanz: true, cls: save.glanz >= P.cost ? '' : 'gray', fn: () => { if (save.glanz < P.cost) return sfx.play('ui'); save.glanz -= P.cost; save.plats[P.id] = true; save.platSel = P.id; persist(); sfx.play('win'); openPlatShop(); } },
  ] });
}
// ===== Murmelautomat (Gacha)
const GACHA_1 = 12, GACHA_10 = 108;
function rollInst(g) {
  const q = Math.random(); const x = JSON.parse(JSON.stringify(g));
  x.hearts = Math.max(3, g.hearts + (q > 0.85 ? 1 : q < 0.12 ? -1 : 0));
  x.dmg = Math.round(g.dmg * (0.92 + q * 0.16) * 10) / 10; x.speed = Math.round(g.speed * (0.97 + q * 0.06) * 100) / 100; x.q = Math.round(q * 100);
  return x;
}
function gachaRoll(minIdx = 0) {
  const keys = RAR_KEYS.slice(minIdx); const tot = keys.reduce((a, k) => a + RAR[k].rate, 0);
  let v = Math.random() * tot, rk = keys[0]; for (const k of keys) { v -= RAR[k].rate; if (v <= 0) { rk = k; break; } }
  const pool = BASE.filter((g) => g.rar === rk); return rollInst(pick(pool));
}
function gachaPull(n) {
  const cost = n === 10 ? GACHA_10 : GACHA_1; if (save.glanz < cost) { sfx.play('ui'); return null; }
  save.glanz -= cost; const out = [];
  const PITY = 50;
  for (let i = 0; i < n; i++) { save.pity = (save.pity || 0) + 1; let g = save.pity >= PITY ? gachaRoll(3) : gachaRoll(); if (RAR_KEYS.indexOf(g.rar) >= 3) save.pity = 0; out.push(g); }
  if (n === 10 && !out.some((g) => RAR_KEYS.indexOf(g.rar) >= 2)) out[9] = gachaRoll(2);
  for (const g of out) { const isNew = !save.book[g.id]; g._new = isNew; save.unlocked[g.key] = true; g._uid = addInv({ ...g }); }
  persist(); return out;
}
function drawGacha(ctx, A, t) {
  const sh = A.ph === 'crank' ? Math.round(Math.sin(t * 60)) : 0;
  ctx.clearRect(0, 0, 140, 200);
  ctx.fillStyle = 'rgba(26,18,36,0.5)'; ctx.beginPath(); ctx.ellipse(62, 196, 54, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(AM.cap, 28 + sh, 2);
  for (const b of A.balls) { const j = A.ph === 'crank' ? Math.round(Math.random() * 2 - 1) : 0; ctx.drawImage(AM.balls[b.c], b.x - 6 + sh + j, b.y - 6 - Math.abs(j)); }
  ctx.drawImage(AM.globe, 6 + sh, 18);
  ctx.drawImage(AM.body, 8 + sh, 112);
  const cf = A.ph === 'crank' ? Math.floor(t * 14) % 4 : 0; ctx.drawImage(AM.crank[cf], 106 + sh, 120 + (A.ph === 'idle' && Math.floor(t * 2) % 2 ? -1 : 0));
  if (A.ph === 'out' || A.ph === 'pop') {
    const rk = A.best, col = RAR[rk].color, k = Math.min(1, A.t / 0.5), x = 62, y = 150 + k * 30 - Math.abs(Math.sin(k * Math.PI * 2)) * 8 * (1 - k);
    if (RAR_KEYS.indexOf(rk) >= 2) { ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 12); ctx.fillStyle = col; for (let a = 0; a < 10; a++) { const an = a / 10 * Math.PI * 2 + t * 1.5; ctx.save(); ctx.translate(x, y); ctx.rotate(an); ctx.fillRect(0, -1, 40, 2); ctx.restore(); } ctx.globalAlpha = 1; }
    const op = A.ph === 'pop' ? Math.min(1, A.t / 0.3) : 0;
    ctx.drawImage(AM.rcap[rk], x - 16, y);
    ctx.globalAlpha = 1 - op; ctx.drawImage(AM.top32, x - 16 + op * 12, y - 16 - op * 26); ctx.globalAlpha = 1;
  }
}
AM.rcap = {}; RAR_KEYS.forEach((k) => (AM.rcap[k] = UI('cap_r_' + k)));
function openGacha() {
  initMeta();
  openDialog({ head: 'Murmelautomat', sub: `${IC('glanz')} ${save.glanz} Glanz`, noAuto: true, mount: (el) => {
    shopTabs(el);
    const rates = document.createElement('div'); rates.className = 'chips'; rates.style.justifyContent = 'center';
    rates.innerHTML = `<span class="bdg rb" style="--rc:#ffcf4a">LEGENDÄR SPÄTESTENS IN ${50 - (save.pity || 0)} ZÜGEN</span>` + RAR_KEYS.map((k) => `<span class="bdg rb" style="--rc:${RAR[k].color}">${RAR[k].name.toUpperCase()} ${RAR[k].rate}%</span>`).join('');
    const cv = document.createElement('canvas'); cv.width = 140; cv.height = 200; cv.className = 'gacha';
    el.appendChild(cv); el.appendChild(rates);
    const ctx = cv.getContext('2d');
    const A = { ph: 'idle', t: 0, balls: pilePositions(20).map(([x, y]) => ({ x: x - 30, y: y - 32, c: (Math.random() * 7) | 0 })), best: 'normal' };
    G.gacha = A; let lt = performance.now();
    const loop = (now) => {
      if (!cv.isConnected) { if (G.gacha === A) G.gacha = null; return; }
      const dt = Math.min(0.05, (now - lt) / 1000); lt = now; A.t += dt;
      if (A.ph === 'crank' && A.t > 0.75) { A.ph = 'out'; A.t = 0; sfx.play('launch'); }
      if (A.ph === 'out' && A.t > 0.7) { A.ph = 'pop'; A.t = 0; sfx.play(RAR_KEYS.indexOf(A.best) >= 3 ? 'win' : 'pop'); }
      if (A.ph === 'pop' && A.t > 0.45) { A.ph = 'done'; gachaReveal(A.res); return; }
      drawGacha(ctx, A, now / 1000); requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    A.start = (n) => { if (A.ph !== 'idle') return; const res = gachaPull(n); if (!res) return; A.res = res; A.best = res.reduce((m, g) => (RAR_KEYS.indexOf(g.rar) > RAR_KEYS.indexOf(m) ? g.rar : m), 'normal'); A.ph = 'crank'; A.t = 0; sfx.play('ui'); $('msgRow').style.visibility = 'hidden'; };
    cv.onclick = () => A.start(1);
  }, buttons: [
    { label: 'Zurück', cls: 'gray', fn: () => { closeDialog(); showTitle(); } },
    { label: `1× · ${GACHA_1}`, glanz: true, cls: save.glanz >= GACHA_1 ? '' : 'gray', fn: () => G.gacha && G.gacha.start(1) },
    { label: `10× · ${GACHA_10}`, glanz: true, cls: save.glanz >= GACHA_10 ? '' : 'gray', fn: () => G.gacha && G.gacha.start(10) },
  ] });
}
function gachaReveal(res) {
  $('msgRow').style.visibility = '';
  const one = res.length === 1; const g = res[0];
  const newB = (x) => (x._new ? bdg(UIC('st_mut'), 'NEU!', true) : '');
  openDialog({ head: one ? (g._new ? 'Neue Murmel!' : 'Murmel gezogen') : '10 Murmeln!', noAuto: true, mount: (el) => {
    if (one) { el.insertAdjacentHTML('beforeend', `<div class="reveal" style="--rc:${RAR[g.rar].color}">${marbleCard(g, { badge: newB(g) })}</div>`); return; }
    el.appendChild(grid(res.map((x) => ({ g: x, tag: x._new ? 'NEU' : '' })), (x) => openDialog({ head: x.g.name, noAuto: true, mount: (e2) => e2.insertAdjacentHTML('beforeend', marbleCard(x.g, { badge: newB(x.g) })), buttons: [{ label: 'Zurück', fn: () => gachaReveal(res) }] })));
  }, buttons: [
    { label: 'Fertig', cls: 'gray', fn: () => { closeDialog(); showTitle(); } },
    ...(one ? [{ label: 'Benutzen', cls: 'gray', fn: () => { save.selU = g._uid; persist(); closeDialog(); showTitle(); } }] : []),
    { label: 'Nochmal', fn: openGacha },
  ] });
}
function openMarbleShop() { if (shopTab === 'p') return openPlatShop(); return openGacha(); }
const FZ = { a: null, b: null };
function openFusion() {
  const A = save.inv.find((x) => x.uid === FZ.a), Bm = save.inv.find((x) => x.uid === FZ.b);
  const child = A && Bm ? fuse(A.g, Bm.g) : null; const known = child && save.book[child.id];
  openDialog({ head: 'Fusionslabor', sub: `<span class="chips" style="justify-content:center">${chip(MIC('kern'), save.cores + ' Kerne', '#c08bff')}${chip(UIC('st_kill'), 'Eltern werden verbraucht', '#ff5a6e')}</span>`, noAuto: true, mount: (el) => {
    const f = document.createElement('div'); f.className = 'fuse';
    const slot = (it, key) => { const d = document.createElement('div'); d.className = 'slot'; if (it) { d.appendChild(gCanvas(it.g)); d.insertAdjacentHTML('beforeend', `<div class="small">${it.g.name}</div>`); } else d.innerHTML = '<div class="big">+</div>'; d.onclick = () => pickFor(key); return d; };
    f.appendChild(slot(A, 'a')); f.insertAdjacentHTML('beforeend', '<div class="big">+</div>'); f.appendChild(slot(Bm, 'b')); f.insertAdjacentHTML('beforeend', '<div class="big">=</div>');
    const r = document.createElement('div'); r.className = 'slot'; r.style.borderStyle = 'solid';
    if (child) { r.appendChild(gCanvas(child, 16, 0, !known)); r.insertAdjacentHTML('beforeend', `<div class="small">${known ? child.name : '???'}</div>`); } else r.innerHTML = '<div class="big">?</div>';
    f.appendChild(r); el.appendChild(f);
    if (child) el.insertAdjacentHTML('beforeend', known ? marbleCard(child) : marbleCard(child, { hidden: true, hint: bdg(UIC('st_gen'), 'GEN ' + child.gen), chips: child.els.map((e) => chip(UIC('el_' + e), ELEMENTS[e].name, ELEMENTS[e].color)).join('') + chip(UIC('st_mut'), elementName(child.els) + '?', '#ffd45c') }));
  }, buttons: [
    { label: 'Zurück', cls: 'gray', fn: () => { closeDialog(); showTitle(); } },
    ...(child ? [{ label: save.cores > 0 ? 'FUSIONIEREN (1 Kern)' : 'Kein Fusionskern', fn: () => doFuse(A, Bm, child) }] : []),
  ] });
}
function pickFor(key) {
  const other = key === 'a' ? FZ.b : FZ.a;
  openDialog({ head: 'Elternteil wählen', noAuto: true, mount: (el) => el.appendChild(grid(save.inv.filter((x) => x.uid !== other), (x) => { FZ[key] = x.uid; openFusion(); }, FZ[key])), buttons: [{ label: 'Zurück', fn: openFusion }] });
}
function doFuse(A, Bm, child) {
  if (save.cores < 1) { sfx.play('ui'); return; }
  const isNew = !save.book[child.id];
  save.cores--; save.inv = save.inv.filter((x) => x.uid !== A.uid && x.uid !== Bm.uid);
  const uid = addInv(child); save.selU = uid; FZ.a = FZ.b = null; persist();
  sfx.play('win'); 
  openDialog({ head: isNew ? 'Neu entdeckt!' : 'Fusion gelungen!', noAuto: true, mount: (el) => {
    const c = gCanvas(child); c.style.cssText = 'width:calc(var(--u)*56);height:calc(var(--u)*56);image-rendering:pixelated'; el.appendChild(c);
    el.insertAdjacentHTML('beforeend', marbleCard(child, { badge: isNew ? bdg(UIC('st_mut'), 'NEU!', true) : '' }));
  }, buttons: [{ label: 'Super!', fn: () => { closeDialog(); showTitle(); } }] });
}
const WS = {
  herz: { name: 'Zähes Herz', text: '+1 Start-Herz', cost: [15, 30, 50] },
  gold: { name: 'Startkapital', text: '+25 Münzen zu Beginn', cost: [10, 20, 35] },
  reroll: { name: 'Neuwürfeln', text: '+1 Neuwurf der Power-up-Wahl pro Run', cost: [20, 35, 55] },
  rabatt: { name: 'Feilschen', text: '−10 % Ladenpreise', cost: [15, 30, 45] },
  start: { name: 'Startgeschenk', text: 'Zufälliges Power-up beim Start', cost: [40] },
  glueck: { name: 'Glücksstern', text: 'Seltene Power-ups öfter', cost: [30, 60] },
  kern: { name: 'Kernsucher', text: '+15 % Fusionskern-Chance bei Elites', cost: [25, 50] },
};
function openWerkstatt() {
  openDialog({ head: 'Werkstatt', tiles: [{ ic: MIC('glanz'), v: save.glanz, l: 'Glanz' }, { ic: UIC('i_werk'), v: Object.values(save.ws).reduce((a, b) => a + b, 0), l: 'Upgrades' }, { ic: MIC('kern'), v: save.cores, l: 'Kerne' }], noAuto: true, cards: Object.entries(WS).map(([k, w]) => {
    const L = ws(k), max = w.cost.length, c = w.cost[L];
    const col = L >= max ? '#8fd16a' : '#ffd45c';
    return { html: uCard({ icon: 'assets/icons/' + { herz: 'herz', gold: 'goldgier', reroll: 'wuerfel', rabatt: 'zinsen', start: 'klee', glueck: 'sternschnuppe', kern: 'kopfgeld' }[k] + '.png', color: col, title: w.name, tag: L >= max ? 'MAXIMAL' : `STUFE ${L + 1}`, pips: lvPips(L, max, L < max), text: w.text, price: L >= max ? 'MAX' : `${c}${MIC('glanz')}` }), dis: L >= max || save.glanz < c,
      fn: () => { save.glanz -= c; save.ws[k] = L + 1; persist(); sfx.play('pickup'); openWerkstatt(); } };
  }), buttons: [{ label: 'Zurück', fn: () => { closeDialog(); showTitle(); } }] });
}
let buchTab = 'm';
function goals() {
  const known = (f) => BASE.filter(f).filter((g) => save.book[g.id]).length, tot = (f) => BASE.filter(f).length;
  const L = [];
  for (const e of Object.keys(ELEMENTS)) { const f = (g) => g.els.includes(e); L.push({ id: 'el_' + e, icon: `assets/ui/el_${e}.png`, col: ELEMENTS[e].color, title: 'Alle ' + ELEMENTS[e].name + '-Murmeln', have: known(f), need: tot(f), rew: 10 }); }
  RAR_KEYS.forEach((r, i) => { const f = (g) => g.rar === r; L.push({ id: 'rar_' + r, icon: 'assets/ui/i_buch.png', col: RAR[r].color, title: 'Alle ' + RAR[r].name + 'en', have: known(f), need: tot(f), rew: [15, 20, 30, 50, 100][i] }); });
  const fz = Object.values(save.book).filter((g) => g.gen > 0).length;
  for (const [n, rew] of [[5, 15], [15, 30], [40, 60], [100, 120]]) L.push({ id: 'fus_' + n, icon: 'assets/ui/i_fusion.png', col: '#c08bff', title: n + ' Fusionen entdecken', have: Math.min(fz, n), need: n, rew });
  const gen = Math.max(0, ...Object.values(save.book).map((g) => g.gen));
  for (const [n, rew] of [[3, 20], [6, 50]]) L.push({ id: 'gen_' + n, icon: 'assets/ui/st_gen.png', col: '#ffd45c', title: 'Generation ' + n + ' erreichen', have: Math.min(gen, n), need: n, rew });
  return L;
}
function famTree(g, depth = 0) {
  const p = (g.pids || []).map((id) => save.book[id]).filter(Boolean);
  const me = `<div class="ft-n"><img src="${gPortrait(g)}" style="--rc:${RAR[rarOf(g)].color}"><span>${g.name}</span></div>`;
  if (!p.length || depth > 2) return `<div class="ft">${me}</div>`;
  return `<div class="ft">${me}<div class="ft-p">${p.map((x) => famTree(x, depth + 1)).join('')}</div></div>`;
}
function openBuch() {
  save.goals = save.goals || {};
  const all = Object.values(save.book).sort((a, b) => a.gen - b.gen || (a.name < b.name ? -1 : 1));
  const baseKnown = BASE.map((g) => (save.book[g.id] ? g : { ...g, hidden: true }));
  const fused = all.filter((g) => g.gen > 0);
  const G2 = goals(), open = G2.filter((x) => x.have >= x.need && !save.goals[x.id]).length;
  openDialog({ head: 'Sammelbuch', tiles: [{ ic: UIC('i_buch'), v: `${BASE.filter((g) => save.book[g.id]).length}/${BASE.length}`, l: 'Murmeln' }, { ic: UIC('st_gen'), v: fused.length, l: 'Fusionen' }, { ic: UIC('st_level'), v: Math.max(0, ...all.map((g) => g.gen)), l: 'Höchste Gen' }], noAuto: true, mount: (el) => {
    const t = document.createElement('div'); t.className = 'tabs';
    t.innerHTML = `<button class="tab${buchTab === 'm' ? ' on' : ''}">${UIC('i_buch')}Murmeln</button><button class="tab${buchTab === 'z' ? ' on' : ''}">${UIC('st_mut')}Ziele${open ? ` <b class="dot">${open}</b>` : ''}</button>`;
    t.children[0].onclick = () => { buchTab = 'm'; sfx.play('ui'); openBuch(); }; t.children[1].onclick = () => { buchTab = 'z'; sfx.play('ui'); openBuch(); };
    el.appendChild(t);
    if (buchTab === 'm') {
      el.appendChild(grid([...baseKnown.map((g) => (g.hidden ? { g, hidden: true } : g)), ...fused], (x) => { const g = x.g || x; if (x.hidden) return; openDialog({ head: g.name, noAuto: true, mount: (e2) => { e2.insertAdjacentHTML('beforeend', marbleCard(g)); if (g.pids) e2.insertAdjacentHTML('beforeend', `<div class="ftw">${famTree(g)}</div>`); }, buttons: [{ label: 'Zurück', fn: openBuch }] }); }));
    } else {
      const w = document.createElement('div'); w.className = 'goals';
      for (const x of G2) {
        const done = save.goals[x.id], ready = x.have >= x.need && !done;
        const d = document.createElement('div'); d.className = 'goal' + (done ? ' done' : ready ? ' ready' : '');
        d.innerHTML = uCard({ icon: x.icon, color: x.col, title: x.title, tag: done ? 'ERLEDIGT' : `${x.have}/${x.need}`, after: segBar(x.have, x.need, x.col), price: `${x.rew}${MIC('glanz')}` });
        if (ready) d.onclick = () => { save.goals[x.id] = true; save.glanz += x.rew; persist(); sfx.play('win'); buzz(30); openBuch(); };
        w.appendChild(d);
      }
      el.appendChild(w);
    }
  }, buttons: [{ label: 'Zurück', fn: () => { closeDialog(); showTitle(); } }] });
}
// ===== Tageslauf
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function seeded(seed) { let s2 = seed >>> 0 || 1; return () => { s2 ^= s2 << 13; s2 >>>= 0; s2 ^= s2 >> 17; s2 ^= s2 << 5; s2 >>>= 0; return s2 / 4294967296; }; }
function dailySetup() {
  const key = todayKey(); let h = 2166136261; for (const c of key) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } const r = seeded(h);
  const pk = (a) => a[Math.floor(r() * a.length)];
  const g = pk(BASE.filter((x) => x.rar !== 'mythisch')); const P = pk(PLATFORMS);
  const pus = []; const keys = Object.keys(POWERUPS).filter((k) => POWERUPS[k].r !== 'curse'); while (pus.length < 3) { const k = pk(keys); if (!pus.includes(k)) pus.push(k); }
  const relic = pk(Object.keys(RELICS));
  return { key, seed: h, g, P, pus, relic };
}
function openDaily() {
  const D = dailySetup(); save.daily = save.daily || {}; const best = save.daily[D.key];
  const hist = Object.entries(save.daily).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 7);
  openDialog({ head: 'Tageslauf', sub: `${D.key} · für alle gleich`, noAuto: true, mount: (el) => {
    el.insertAdjacentHTML('beforeend', marbleCard(D.g, { badge: bdg(UIC('i_daily'), 'HEUTE') }));
    el.insertAdjacentHTML('beforeend', `<div class="dl">${uCard({ icon: `assets/plat/${D.P.id}.png`, color: D.P.col, title: D.P.name, tag: 'PLATTFORM', text: D.P.text })}${relCard(D.relic).html}<div class="chips" style="justify-content:center">${D.pus.map((k) => `<span class="chip" style="--cc:${RARITY[POWERUPS[k].r].color}"><img class="px" src="assets/icons/${k}.png">${POWERUPS[k].name}</span>`).join('')}</div></div>`);
    el.insertAdjacentHTML('beforeend', tiles([{ ic: UIC('st_level'), v: best ? best.fl + '/60' : '0', l: 'Heute bestes' }, { ic: UIC('st_kill'), v: best ? best.kills : '0', l: 'Besiegt' }, ...hist.filter((x) => x[0] !== D.key).slice(0, 4).map(([k, v]) => ({ ic: UIC('i_daily'), v: v.fl + '/60', l: k.slice(5) }))]));
  }, buttons: [{ label: 'Zurück', cls: 'gray', fn: () => { closeDialog(); showTitle(); } }, { label: best ? 'Nochmal' : 'Starten', fn: () => startDaily(D) }] });
}
let realRandom = Math.random;
function startDaily(D) {
  closeDialog(); const r = seeded(D.seed); Math.random = r;
  const saved = save.platSel; save.platSel = D.P.id; newRun(JSON.parse(JSON.stringify(D.g))); save.platSel = saved;
  const R = G.run; R.daily = D.key; for (const k of D.pus) applyPU(k); giveRelic(D.relic);
}
function dailyResult(fl, kills, win) {
  Math.random = realRandom; save.daily = save.daily || {}; const k = G.run.daily; const o = save.daily[k];
  if (!o || fl > o.fl || (fl === o.fl && kills > o.kills)) save.daily[k] = { fl, kills, win };
}
$('startBtn').onclick = () => { sfx.unlock(); sfx.play('ui'); initMeta(); newRun(selItem().g); };
$('bKiste').onclick = () => { sfx.unlock(); openKiste(); };
$('bLaden').onclick = () => { sfx.unlock(); openMarbleShop(); };
$('bSound').onclick = () => { save.sound = !save.sound; persist(); applySound(); showTitle(); };
$('bVib').onclick = () => { save.vib = save.vib === false; persist(); buzz(30); showTitle(); };
$('bFusion').onclick = () => { sfx.unlock(); openFusion(); };
$('bWerk').onclick = () => { sfx.unlock(); openWerkstatt(); };
$('bBuch').onclick = () => { sfx.unlock(); openBuch(); };
function openHilfe() {
  const c = (icon, title, text, col = '#6fd0f0') => ({ color: col, html: uCard({ icon, color: col, title, text }), fn: () => {} });
  openDialog({ head: 'So spielst du', noAuto: true, cards: [
    c('assets/ui/tr_tippen.png', 'Zielen & Schiessen', 'Im unteren Feld wischen, um zu zielen. Loslassen schiesst die Murmel.'),
    c('assets/ui/st_tempo.png', 'Plattform', 'Wischen bewegt die Plattform. Die Murmel prallt an ihr ab.', '#8fd16a'),
    c('assets/ui/st_mut.png', 'Schwung', 'Tippe, wenn die zurückkehrende Murmel die gestrichelte Linie kreuzt. Jedes Mal schneller!', '#ffd45c'),
    c('assets/ui/i_warn.png', 'Gegnerschüsse', 'Rote Kugeln treffen dich. Das Warnzeichen zeigt, wer gleich schiesst.', '#ff2a3a'),
    c('assets/ui/i_relikt.png', 'Power-ups & Relikte', 'Nach Räumen wählst du Power-ups. Bosse geben Relikte mit Vor- und Nachteil.', '#c08bff'),
  ], buttons: [{ label: 'Tutorial nochmal', cls: 'gray', fn: () => { save.tut = false; persist(); closeDialog(); showTitle(); } }, { label: 'Verstanden', fn: () => { closeDialog(); showTitle(); } }] });
}
$('bHilfe').onclick = () => { sfx.unlock(); openHilfe(); };
$('bDaily').onclick = () => { sfx.unlock(); initMeta(); openDaily(); };

// ---------------------------------------------------------------- Loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  G.ft = (G.ft || 0.016) * 0.97 + dt * 0.03; FXQ.low = G.ft > 0.024;
  step(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
function step(dt) {
  G.t += dt;
  if (G.mode === 'play' && !G.dialog && !G.paused) zoneFx(dt);
  if (G.mode === 'play' && !G.dialog && !G.paused) { let d2 = dt; if (G.slow > 0) { G.slow -= dt; d2 = dt * 0.4; } if (G.hitstop > 0) G.hitstop -= dt; else { keyAim(d2); update(d2); } updateNums(dt); }
  if (G.mode === 'map') drawMap();
  if (G.mode === 'title' && demo.plat) demoTick(dt);
  updateParticles(dt);
  bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('on');
  G.shake = Math.max(0, G.shake - dt);
  camera.position.x = G.shake > 0 ? Math.round(rnd(-1.5, 1.5)) : 0; camera.position.y = G.shake > 0 ? Math.round(rnd(-1.5, 1.5)) : 0;
}

let booted = false;
manager.onLoad = () => { if (booted) return; booted = true; buildBg(); buildTitle(); applySound(); showTitle(); requestAnimationFrame(frame); };

// Test-API
window.__BY = {
  G, save,
  setAuto(v) { G.auto = v; },
  glanz(n) { save.glanz += n; persist(); }, victory() { victory(); }, coins(n) { for (let i = 0; i < n; i++) dropCoin(90, 120); }, relic(k) { giveRelic(k); }, relicChoice() { relicChoice('Test', () => {}); },
  pat(p, k = 'seed') { const e = G.room.enemies.find((x) => !x.dead); if (e) shotPattern(e, p, k, 70); },
  start(mk = 'nib') { save.unlocked[mk] = true; newRun(BASE_BY[mk]); },
  newRunG(g) { newRun(g); }, platShop: () => { shopTab = 'p'; openMarbleShop(); }, PLAT_BY, FXC, shop: () => openMarbleShop(), title: () => showTitle(), map: () => showMap(), fuse, BASE_BY, kiste: () => openKiste(), fusion: () => openFusion(), werk: () => openWerkstatt(), buch: () => openBuch(), FZ, initMeta,
  sim(sec, dt = 1 / 60) { for (let t = 0; t < sec; t += dt) step(dt); return { mode: G.mode, floor: G.run && G.run.floor, hearts: G.run && G.run.hearts, enemies: G.room && G.room.enemies.length, last: G.lastResult }; },
  give(k, n = 1) { for (let i = 0; i < n; i++) applyPU(k); },
};
Object.assign(window.__BY, { room: (t) => startRoom(t), choice: () => puChoice('Raum geschafft!', 'Wähle 1 von 3 Power-ups', 'common', () => {}), shop: () => { closeDialog(); G.run.coins = 140; openShop(); } });
Object.assign(window.__BY, { chapter: (c) => { G.run.chapter = c; G.run.map = genMap(); buildBg(c); }, room2: (t, ev) => startRoom(t, ev) });
