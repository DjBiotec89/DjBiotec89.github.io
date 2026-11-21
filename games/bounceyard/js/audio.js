// BOUNCEYARD – synthetische Soundeffekte und Musik (WebAudio, keine Dateien nötig)
export class Audio {
  constructor() {
    this.ctx = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.master = null;
    this.musicGain = null;
    this._musicTimer = null;
    this._step = 0;
    this._worldIdx = 0;
  }

  unlock() {
    if (this._track && this._track.paused) this._track.play().catch(() => {});
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicOn ? 0.22 : 0;
      this.musicGain.connect(this.master);
    } catch (e) { this.ctx = null; }
  }

  _tone(freq, dur, type = 'square', vol = 0.2, slide = 0, delay = 0, dest = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _noise(dur, vol = 0.25, filterFreq = 1200, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  play(name, pitch = 1) {
    if (!this.sfxOn || !this.ctx) return;
    switch (name) {
      case 'wall': this._tone(220 * pitch, 0.06, 'triangle', 0.12, 0.7); break;
      case 'hit': this._tone(520 * pitch, 0.08, 'square', 0.13, 1.6); break;
      case 'armor': this._tone(180 * pitch, 0.1, 'square', 0.15, 0.6); this._noise(0.06, 0.12, 2500); break;
      case 'pop': this._tone(660 * pitch, 0.12, 'triangle', 0.2, 2.2); this._noise(0.08, 0.1, 4000); break;
      case 'coin': this._tone(988, 0.07, 'square', 0.12); this._tone(1318, 0.18, 'square', 0.12, 1, 0.07); break;
      case 'catch': this._tone(330, 0.07, 'triangle', 0.18, 1.5); break;
      case 'perfect': this._tone(660, 0.06, 'triangle', 0.15); this._tone(880, 0.06, 'triangle', 0.15, 1, 0.05); this._tone(1320, 0.14, 'triangle', 0.15, 1, 0.1); break;
      case 'launch': this._tone(240, 0.14, 'sawtooth', 0.1, 3); break;
      case 'skill': this._tone(400, 0.2, 'sawtooth', 0.12, 2.5); this._tone(800, 0.15, 'triangle', 0.1, 1.8, 0.05); break;
      case 'bumper': this._tone(300, 0.12, 'square', 0.16, 2.6); break;
      case 'boom': this._noise(0.45, 0.45, 900); this._tone(90, 0.35, 'sine', 0.35, 0.4); break;
      case 'lose': this._tone(330, 0.18, 'triangle', 0.18, 0.5); this._tone(220, 0.3, 'triangle', 0.18, 0.5, 0.15); break;
      case 'stun': this._tone(140, 0.25, 'sawtooth', 0.15, 0.5); break;
      case 'pickup': [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.08, 'square', 0.1, 1, i * 0.05)); break;
      case 'roar': this._tone(110, 0.6, 'sawtooth', 0.2, 0.5); this._noise(0.5, 0.15, 600); break;
      case 'zap': this._noise(0.12, 0.2, 6000); this._tone(1200, 0.1, 'square', 0.08, 0.3); break;
      case 'win': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this._tone(f, 0.16, 'square', 0.12, 1, i * 0.09)); break;
      case 'gameover': [392, 349, 311, 262].forEach((f, i) => this._tone(f, 0.25, 'triangle', 0.16, 1, i * 0.18)); break;
      case 'ui': this._tone(700, 0.05, 'square', 0.08); break;
      case 'star': this._tone(1046 * pitch, 0.2, 'triangle', 0.16, 1.2); break;
    }
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.musicGain) this.musicGain.gain.value = on ? 0.22 : 0;
    if (this._track) this._track.muted = !on;
  }
  // Suno-Soundtrack: assets/music/<name>.mp3 – fehlt die Datei, läuft die eingebaute Synth-Musik
  playTrack(name, worldIdx = 0, intense = false) {
    if (this._trackName === name && this._track) return;
    this._missing = this._missing || new Set();
    if (this._missing.has(name)) { if (!(this._musicTimer && this._worldIdx === worldIdx && this._intense === intense)) { this.stopMusic(); this.startMusic(worldIdx, intense); this._intense = intense; } return; }
    this.stopMusic();
    this._trackName = name;
    const a = new window.Audio(`assets/music/${name}.mp3`); a.loop = true; a.volume = 0.5; a.muted = !this.musicOn; a.preload = 'auto';
    let ok = false;
    a.addEventListener('canplay', () => { if (this._trackName !== name) return; ok = true; this._track = a; a.play().catch(() => {}); }, { once: true });
    a.addEventListener('error', () => { this._missing.add(name); if (this._trackName !== name || ok) return; this._track = null; this.startMusic(worldIdx, intense); this._intense = intense; }, { once: true });
    this._pending = a;
  }

  // Kleine generative Melodie pro Welt
  startMusic(worldIdx = 0, intense = false) {
    this.stopMusic();
    if (!this.ctx) return;
    this._worldIdx = worldIdx;
    const scales = [
      [0, 2, 4, 7, 9], [0, 3, 5, 7, 10], [0, 2, 3, 7, 8], [0, 2, 4, 6, 9], [0, 4, 5, 7, 11], [0, 2, 4, 7, 11]
    ];
    const roots = [261.6, 233.1, 220, 293.7, 277.2, 246.9];
    const scale = scales[worldIdx % scales.length];
    const root = roots[worldIdx % roots.length] * (intense ? 0.5 : 0.5);
    const bpm = intense ? 138 : 112;
    const stepDur = 60 / bpm / 2;
    const prog = [0, 3, 4, 2];
    let seed = 7 + worldIdx * 13;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const melody = Array.from({ length: 32 }, () => (rnd() < 0.62 ? Math.floor(rnd() * 8) : -1));
    this._step = 0;
    const tick = () => {
      if (!this.ctx) return;
      const s = this._step++;
      const bar = Math.floor(s / 8) % 4;
      const chordRoot = scale[prog[bar] % scale.length];
      const f = (deg, oct) => root * Math.pow(2, (scale[((deg % scale.length) + scale.length) % scale.length] + 12 * (oct + Math.floor(deg / scale.length))) / 12);
      if (s % 2 === 0) this._tone(root * Math.pow(2, chordRoot / 12) * (s % 4 === 0 ? 1 : 2), stepDur * 1.6, 'triangle', 0.28, 1, 0, this.musicGain);
      const m = melody[s % 32];
      if (m >= 0) this._tone(f(m + prog[bar], 2), stepDur * 0.9, 'square', 0.07, 1, 0, this.musicGain);
      if (intense && s % 4 === 2) this._noise(0.05, 0.05, 7000);
    };
    this._musicTimer = setInterval(tick, stepDur * 1000);
  }

  stopMusic() {
    if (this._musicTimer) clearInterval(this._musicTimer);
    this._musicTimer = null;
    if (this._track) { this._track.pause(); this._track = null; }
    if (this._pending) { this._pending.src = ''; this._pending = null; }
    this._trackName = null;
  }
}
