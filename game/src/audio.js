// Azura Bay — sound, synthesized live with WebAudio. No audio files:
// engine hum follows speed, the siren wails two tones, UI pops on clicks.

let ctx = null;
let engineOsc = null;
let engineGain = null;
let engineFilter = null;
let sirenOsc = null;
let sirenGain = null;
let sirenTimer = 0;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    ctx = null;
  }
  if (!ctx) return;
  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 55;
  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 420;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  engineOsc.connect(engineFilter).connect(engineGain).connect(ctx.destination);
  engineOsc.start();
  sirenOsc = ctx.createOscillator();
  sirenOsc.type = 'triangle';
  sirenOsc.frequency.value = 720;
  sirenGain = ctx.createGain();
  sirenGain.gain.value = 0;
  sirenOsc.connect(sirenGain).connect(ctx.destination);
  sirenOsc.start();
}

export function setEngine(speed01, on) {
  if (!ctx || !engineOsc) return;
  const t = ctx.currentTime;
  engineOsc.frequency.setTargetAtTime(52 + speed01 * 165, t, 0.08);
  engineFilter.frequency.setTargetAtTime(380 + speed01 * 1400, t, 0.1);
  engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0, t, 0.1);
}

export function setSiren(on, t) {
  if (!ctx || !sirenOsc) return;
  if (on) {
    sirenGain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.1);
    sirenOsc.frequency.setTargetAtTime(Math.floor(t * 1.6) % 2 === 0 ? 720 : 960, ctx.currentTime, 0.05);
  } else {
    sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
  }
}

export function blip(freq) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = freq || 660;
  g.gain.setValueAtTime(0.08, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + 0.13);
}
