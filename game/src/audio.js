// Ember Isle sound: all synthesized with WebAudio, no audio files, no network.
export function makeAudio() {
  let ctx = null;
  let unlocked = false;
  let muted = false;
  let engineOsc = null, engineGain = null, engineFilter = null;

  function ac() {
    // Never create or resume an AudioContext before a user gesture: browsers
    // log an autoplay warning for every attempt, and the game needs no sound
    // until the player presses START.
    if (!unlocked) return null;
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  }
  function noise(dur, vol, lowpass) {
    if (muted) return;
    const c = ac(); if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(c.destination);
    src.start();
  }

  return {
    unlock() { unlocked = true; ac(); },
    toggleMute() { muted = !muted; if (muted) this.stopEngine(); return muted; },
    get muted() { return muted; },
    shoot(kind) {
      if (kind === 'smg') { noise(0.09, 0.5, 2600); tone(220, 0.07, 'square', 0.16, 90); }
      else if (kind === 'shotgun') { noise(0.28, 0.8, 1400); tone(140, 0.2, 'sawtooth', 0.25, 50); }
      else { noise(0.14, 0.6, 3200); tone(180, 0.1, 'square', 0.2, 70); }
    },
    hit() { tone(320, 0.08, 'triangle', 0.2, 180); },
    pickup() { tone(660, 0.09, 'sine', 0.25); setTimeout(() => tone(990, 0.14, 'sine', 0.25), 90); },
    cash() { tone(880, 0.08, 'sine', 0.22); setTimeout(() => tone(1174, 0.08, 'sine', 0.22), 80); setTimeout(() => tone(1568, 0.16, 'sine', 0.22), 160); },
    mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.25), i * 110)); },
    siren() { tone(700, 0.5, 'sine', 0.10, 950); },
    crash() { noise(0.3, 0.7, 700); tone(90, 0.25, 'sawtooth', 0.3, 40); },
    splash() { noise(0.5, 0.4, 900); },
    startEngine(speed) {
      if (muted) return;
      const c = ac(); if (!c) return;
      if (!engineOsc) {
        engineOsc = c.createOscillator(); engineOsc.type = 'sawtooth';
        engineFilter = c.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 420;
        engineGain = c.createGain(); engineGain.gain.value = 0.0;
        engineOsc.connect(engineFilter).connect(engineGain).connect(c.destination);
        engineOsc.start();
      }
      const rpm = 50 + Math.min(1, speed / 340) * 110;
      engineOsc.frequency.setTargetAtTime(rpm, c.currentTime, 0.1);
      engineGain.gain.setTargetAtTime(0.05, c.currentTime, 0.2);
    },
    stopEngine() {
      if (engineGain) engineGain.gain.setTargetAtTime(0, ctx ? ctx.currentTime : 0, 0.1);
    },
  };
}
