// Sound, all synthesised with WebAudio — no audio files, no network. A tiny synth voice
// for blips and shots, a looping engine hum that follows the car's speed, and a two-tone
// police siren that fades in with the wanted level. Created lazily on the first gesture,
// so browsers' autoplay rules never block the game.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine that an LFO swings between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  /** One short tone. */
  function tone(freq, dur, type = 'sine', volume = 0.2, slideTo = null) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** A burst of filtered noise (gunshot, crash, pickup tick). */
  function noise(dur, volume = 0.3, freq = 1200) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  return {
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    blip() { tone(880, 0.09, 'sine', 0.16); },
    confirm() { tone(660, 0.08, 'sine', 0.18); tone(990, 0.12, 'sine', 0.18); },
    error() { tone(220, 0.16, 'square', 0.12, 140); },
    shot() { noise(0.14, 0.5, 2400); tone(180, 0.08, 'square', 0.2, 60); },
    enemyShot() { noise(0.12, 0.22, 1600); },
    crash() { noise(0.3, 0.5, 500); tone(90, 0.25, 'sawtooth', 0.2, 40); },
    pickup() { tone(1320, 0.07, 'sine', 0.18); tone(1760, 0.1, 'sine', 0.18); },
    missionDone() {
      tone(523, 0.12, 'sine', 0.22);
      setTimeout(() => tone(659, 0.12, 'sine', 0.22), 120);
      setTimeout(() => tone(784, 0.22, 'sine', 0.24), 240);
    },
    busted() { tone(440, 0.3, 'sawtooth', 0.2, 220); tone(330, 0.4, 'sawtooth', 0.2, 160); },
    /** Called every frame: engine pitch follows speed, siren follows wanted stars. */
    update(speed, wanted) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      if (engineGain) {
        const target = speed > 5 ? 0.05 + Math.min(0.12, speed / 5200) : 0;
        engineGain.gain.setTargetAtTime(target, t, 0.1);
        engineOsc.frequency.setTargetAtTime(50 + speed * 0.16, t, 0.08);
      }
      if (sirenGain) {
        const target = wanted > 0 ? 0.045 + wanted * 0.008 : 0;
        sirenGain.gain.setTargetAtTime(target, t, 0.4);
      }
    },
  };
}
