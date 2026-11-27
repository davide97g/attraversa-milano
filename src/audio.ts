// Effetti e musica generati con Web Audio: nessun file audio esterno.

let ctx: AudioContext | null = null;
let master: GainNode;
let musicBus: GainNode;
let sfxBus: GainNode;
let noiseBuf: AudioBuffer;
let muted = false;
try {
  muted = localStorage.getItem("am-muted") === "1";
} catch {
  /* niente */
}

export function initAudio() {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.55;
  master.connect(ctx.destination);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.22;
  musicBus.connect(master);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.7;
  sfxBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startMusic();
}

export function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem("am-muted", muted ? "1" : "0");
  } catch {
    /* niente */
  }
  if (ctx) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.02);
  return muted;
}
export const isMuted = () => muted;

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const now = () => (ctx ? ctx.currentTime : 0);

function tone(bus: GainNode, type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number, pan = 0) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let out: AudioNode = g;
  if (pan) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p);
    out = p;
  }
  o.connect(g);
  out.connect(bus);
  o.start(t);
  o.stop(t + dur + 0.03);
}

function noise(bus: GainNode, t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q = 0.7) {
  if (!ctx) return;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(bus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.03);
}

// ---------- effetti ----------
export const sfx = {
  hop() {
    const t = now();
    const p = 1 + (Math.random() - 0.5) * 0.12;
    tone(sfxBus, "sine", 420 * p, 820 * p, t, 0.08, 0.22);
    tone(sfxBus, "triangle", 210 * p, 300 * p, t, 0.05, 0.08);
  },
  land() {
    noise(sfxBus, now(), 0.05, 0.08, "lowpass", 900);
  },
  bump() {
    const t = now();
    tone(sfxBus, "sine", 180, 90, t, 0.1, 0.25);
    noise(sfxBus, t, 0.04, 0.1, "lowpass", 600);
  },
  coin() {
    const t = now();
    tone(sfxBus, "square", hz(88), hz(88), t, 0.07, 0.07);
    tone(sfxBus, "square", hz(95), hz(95), t + 0.07, 0.18, 0.07);
    tone(sfxBus, "sine", hz(100), hz(100), t + 0.07, 0.2, 0.08);
  },
  honk(pan: number) {
    const t = now();
    // clacson a due note, leggermente stonate tra loro
    tone(sfxBus, "sawtooth", 392, 388, t, 0.22, 0.05, pan);
    tone(sfxBus, "sawtooth", 494, 490, t, 0.22, 0.04, pan);
    tone(sfxBus, "sawtooth", 392, 388, t + 0.26, 0.3, 0.05, pan);
    tone(sfxBus, "sawtooth", 494, 490, t + 0.26, 0.3, 0.04, pan);
  },
  vespa(pan: number) {
    const t = now();
    tone(sfxBus, "sawtooth", 140, 260, t, 0.5, 0.035, pan);
    tone(sfxBus, "square", 70, 130, t, 0.5, 0.02, pan);
  },
  // campanella del tram: "din din" metallico
  tramBell(pan: number) {
    const t = now();
    for (const k of [0, 0.22]) {
      [1, 2.76, 5.4].forEach((r, i) => tone(sfxBus, "sine", 1180 * r, 1176 * r, t + k, 0.6 - i * 0.15, 0.12 / (i + 1), pan));
    }
  },
  tramPass(pan: number) {
    const t = now();
    noise(sfxBus, t, 0.9, 0.25, "bandpass", 300, 0.8);
    for (let i = 0; i < 4; i++) noise(sfxBus, t + i * 0.16, 0.05, 0.2, "highpass", 3000);
    tone(sfxBus, "sawtooth", 90, 70, t, 0.8, 0.05, pan);
  },
  splash() {
    const t = now();
    noise(sfxBus, t, 0.5, 0.4, "lowpass", 1800);
    noise(sfxBus, t + 0.03, 0.3, 0.15, "highpass", 4000);
    tone(sfxBus, "sine", 600, 140, t, 0.25, 0.15);
    for (let i = 0; i < 4; i++) tone(sfxBus, "sine", 900 + Math.random() * 900, 1600, t + 0.15 + i * 0.07, 0.05, 0.05);
  },
  squash() {
    const t = now();
    tone(sfxBus, "sine", 160, 40, t, 0.3, 0.45);
    noise(sfxBus, t, 0.2, 0.35, "lowpass", 1200);
    tone(sfxBus, "square", 900, 300, t, 0.08, 0.06);
  },
  whoosh() {
    const t = now();
    noise(sfxBus, t, 0.5, 0.3, "bandpass", 1200, 1.5);
    tone(sfxBus, "sine", 900, 120, t, 0.6, 0.12);
  },
  over() {
    const t = now();
    [7, 4, 0, -5].forEach((s, i) => tone(sfxBus, "triangle", hz(72 + s), hz(72 + s), t + 0.3 + i * 0.16, 0.24, 0.16));
  },
  select() {
    const t = now();
    tone(sfxBus, "triangle", hz(79), hz(79), t, 0.06, 0.18);
    tone(sfxBus, "triangle", hz(84), hz(84), t + 0.06, 0.1, 0.18);
  },
  unlock() {
    const t = now();
    [0, 4, 7, 12, 16].forEach((s, i) => tone(sfxBus, "square", hz(72 + s), hz(72 + s), t + i * 0.07, 0.2, 0.07));
    tone(sfxBus, "sine", hz(96), hz(96), t + 0.35, 0.6, 0.1);
  },
  record() {
    const t = now();
    [0, 4, 7, 12].forEach((s, i) => tone(sfxBus, "triangle", hz(76 + s), hz(76 + s), t + i * 0.09, 0.3, 0.14));
  },
};

// ---------- musica ----------
// Traccia originale: valzerino da balera in Do maggiore, basso "um-pa-pa", fisarmonica finta
// (due seghe dentate scordate e filtrate) e glockenspiel natalizio sopra. 16 battute in 3/4.
const BPM = 150;
const BEAT = 60 / BPM;
const PROG: [number, number[]][] = [
  // [basso, accordo] per battuta
  [48, [64, 67, 72]], [43, [64, 67, 72]], [43, [62, 65, 71]], [48, [64, 67, 72]],
  [53, [65, 69, 72]], [48, [64, 67, 72]], [43, [62, 65, 71]], [48, [64, 67, 72]],
  [45, [64, 69, 72]], [52, [64, 68, 71]], [45, [64, 69, 72]], [50, [65, 69, 74]],
  [48, [64, 67, 72]], [43, [62, 65, 71]], [43, [62, 67, 71]], [48, [64, 67, 72]],
];
// melodia: 3 crome... qui 6 ottavi per battuta, -1 = pausa
const MEL = [
  76, -1, 79, -1, 84, -1,  83, -1, 79, -1, 77, -1,  74, -1, 77, -1, 83, -1,  84, -1, -1, -1, 79, 81,
  81, -1, 84, -1, 89, -1,  88, -1, 84, -1, 79, -1,  77, -1, 76, -1, 74, -1,  72, -1, -1, -1, -1, -1,
  76, -1, 81, -1, 84, -1,  83, -1, 80, -1, 76, -1,  81, -1, 84, -1, 81, -1,  77, -1, 81, -1, 86, -1,
  84, -1, 79, -1, 76, -1,  77, -1, 74, -1, 71, -1,  74, -1, 79, -1, 83, -1,  84, -1, -1, -1, -1, -1,
];

let musicTimer = 0;
let nextT = 0;
let step = 0;

function accordion(midi: number, t: number, dur: number, vol: number) {
  if (!ctx) return;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 2200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.setValueAtTime(vol * 0.8, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  f.connect(g).connect(musicBus);
  for (const det of [-6, 7]) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = hz(midi);
    o.detune.value = det;
    o.connect(f);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

function schedule() {
  if (!ctx) return;
  while (nextT < ctx.currentTime + 0.25) {
    const t = nextT;
    const bar = Math.floor(step / 6) % PROG.length;
    const sub = step % 6;
    const [bass, chord] = PROG[bar];
    if (sub === 0) {
      tone(musicBus, "triangle", hz(bass), hz(bass), t, BEAT * 0.9, 0.5);
      noise(musicBus, t, 0.06, 0.08, "lowpass", 400);
    } else if (sub === 2 || sub === 4) {
      for (const n of chord) accordion(n - 12, t, BEAT * 0.5, 0.05);
      noise(musicBus, t, 0.03, 0.04, "highpass", 7000);
    }
    const m = MEL[step % MEL.length];
    if (m > 0) {
      tone(musicBus, "sine", hz(m), hz(m), t, 0.5, 0.16);
      tone(musicBus, "sine", hz(m + 12), hz(m + 12), t, 0.25, 0.05);
    }
    step++;
    nextT += BEAT / 2;
  }
}

function startMusic() {
  if (!ctx || musicTimer) return;
  nextT = ctx.currentTime + 0.1;
  musicTimer = window.setInterval(schedule, 60);
}
