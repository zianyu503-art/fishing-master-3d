// Procedural Web Audio sound engine for《釣魚大師 3D》
export class FishingAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.ambientGain = null;
    this.lastReelClick = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this._startLakeAmbience();
  }

  toggle() {
    this.init();
    this.enabled = !this.enabled;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(this.enabled ? 0.055 : 0.0, this.ctx.currentTime, 0.15);
    }
    return this.enabled;
  }

  _noiseBuffer(duration = 1.5) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * duration);
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.03 * white) / 1.03;
      data[i] = last * 3.2;
    }
    return buf;
  }

  _startLakeAmbience() {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(4.0);
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 420;
    filter.Q.value = 0.7;

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.18;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = this.enabled ? 0.055 : 0.0;

    src.connect(filter);
    filter.connect(this.ambientGain);
    this.ambientGain.connect(this.ctx.destination);
    src.start();
    lfo.start();
  }

  playCastWhoosh(power = 0.7) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.45);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(280, now);
    filter.frequency.exponentialRampToValueAtTime(1200 + power * 700, now + 0.16);
    filter.frequency.exponentialRampToValueAtTime(320, now + 0.4);
    filter.Q.value = 2.2;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.22 * (0.5 + power * 0.5), now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.44);
  }

  playSplash(intensity = 0.6) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Water bubble plop + spray noise
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(190 + intensity * 80, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.09);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.16 * intensity, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(og);
    og.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);

    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.5);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1900 * intensity + 500, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.42);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.24 * intensity, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
    src.connect(filter);
    filter.connect(ng);
    ng.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.46);
  }

  playNibble() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.06);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.07, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playStrikeAlert() {
    if (!this.enabled || !this.ctx) return;
    this.playSplash(1.0);
    const now = this.ctx.currentTime;
    [587.33, 880].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.12, now + idx * 0.07);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.16);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.17);
    });
  }

  tickReel(tensionRatio = 0.4) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const interval = Math.max(0.038, 0.085 - tensionRatio * 0.045);
    if (now - this.lastReelClick < interval) return;
    this.lastReelClick = now;

    const osc = this.ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(900 + tensionRatio * 950, now);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.032, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.02);
  }

  playSnap() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.22);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playSuccessFanfare() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      const t0 = now + i * 0.09;
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.15, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.46);
    });
  }

  playElectricZap(intensity = 1.0) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(1650 * intensity, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.14);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.16 * intensity, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(og);
    og.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);

    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.24);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2400, now);
    filter.frequency.exponentialRampToValueAtTime(750, now + 0.22);
    filter.Q.value = 3.2;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.24 * intensity, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
    src.connect(filter);
    filter.connect(ng);
    ng.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.24);
  }

  playSharkAttack() {
    if (!this.enabled || !this.ctx) return;
    this.playSplash(1.1);
    const now = this.ctx.currentTime;
    const sub = this.ctx.createOscillator();
    sub.type = "sawtooth";
    sub.frequency.setValueAtTime(135, now);
    sub.frequency.exponentialRampToValueAtTime(38, now + 0.34);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    sub.connect(g);
    g.connect(this.ctx.destination);
    sub.start(now);
    sub.stop(now + 0.37);
  }

  playSharkJumpScare() {
    if (!this.enabled || !this.ctx) return;
    this.playSplash(1.4);
    const now = this.ctx.currentTime;

    // 1. Sudden massive sub-bass boom
    const sub = this.ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(92, now);
    sub.frequency.exponentialRampToValueAtTime(32, now + 0.65);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.65, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    sub.connect(sg);
    sg.connect(this.ctx.destination);
    sub.start(now);
    sub.stop(now + 0.72);

    // 2. Piercing dissonant horror screech cluster (587 / 622 / 1244 Hz)
    [587.33, 622.25, 1244.5].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * (idx === 2 ? 0.92 : 1.04), now + 0.9);
      const bp = this.ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = freq * 1.4;
      bp.Q.value = 1.6;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.22, now + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      osc.connect(bp);
      bp.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.98);
    });

    // 3. Guttural monster roar + panic heartbeats
    const roarSrc = this.ctx.createBufferSource();
    roarSrc.buffer = this._noiseBuffer(1.2);
    const roarFilter = this.ctx.createBiquadFilter();
    roarFilter.type = "lowpass";
    roarFilter.frequency.setValueAtTime(950, now);
    roarFilter.frequency.exponentialRampToValueAtTime(160, now + 1.1);
    const rg = this.ctx.createGain();
    rg.gain.setValueAtTime(0.45, now);
    rg.gain.exponentialRampToValueAtTime(0.001, now + 1.15);
    roarSrc.connect(roarFilter);
    roarFilter.connect(rg);
    rg.connect(this.ctx.destination);
    roarSrc.start(now);
    roarSrc.stop(now + 1.18);

    [0.0, 0.28, 0.54, 0.78, 1.0].forEach((offset) => {
      const hb = this.ctx.createOscillator();
      hb.type = "sine";
      hb.frequency.setValueAtTime(64, now + offset);
      hb.frequency.exponentialRampToValueAtTime(28, now + offset + 0.14);
      const hbg = this.ctx.createGain();
      hbg.gain.setValueAtTime(0.35, now + offset);
      hbg.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.16);
      hb.connect(hbg);
      hbg.connect(this.ctx.destination);
      hb.start(now + offset);
      hb.stop(now + offset + 0.18);
    });
  }

  playSharkChomp() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    const crunch = this.ctx.createBufferSource();
    crunch.buffer = this._noiseBuffer(0.38);
    const hp = this.ctx.createBiquadFilter();
    hp.type = "bandpass";
    hp.frequency.setValueAtTime(1400, now);
    hp.frequency.exponentialRampToValueAtTime(220, now + 0.32);
    hp.Q.value = 1.2;
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.55, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    crunch.connect(hp);
    hp.connect(cg);
    cg.connect(this.ctx.destination);
    crunch.start(now);
    crunch.stop(now + 0.36);

    const thud = this.ctx.createOscillator();
    thud.type = "sawtooth";
    thud.frequency.setValueAtTime(120, now);
    thud.frequency.exponentialRampToValueAtTime(28, now + 0.3);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.45, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    thud.connect(tg);
    tg.connect(this.ctx.destination);
    thud.start(now);
    thud.stop(now + 0.34);
  }
}
