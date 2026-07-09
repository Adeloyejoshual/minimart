class SoundMgr {
  constructor() {
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) {
      this._ctx = null;
    }
    this.muted = false;
  }

  _beep(freq, dur, vol = 0.15, type = "sine") {
    if (this.muted || !this._ctx) return;
    try {
      const osc  = this._ctx.createOscillator();
      const gain = this._ctx.createGain();
      osc.connect(gain);
      gain.connect(this._ctx.destination);
      osc.frequency.value = freq;
      osc.type            = type;
      gain.gain.setValueAtTime(vol, this._ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        this._ctx.currentTime + dur
      );
      osc.start();
      osc.stop(this._ctx.currentTime + dur);
    } catch (_) {}
  }

  tick()      { this._beep(320, 0.04, 0.12, "square"); }
  spinStart() { this._beep(440, 0.08, 0.10, "sine");   }

  taskDone() {
    [523, 659, 784].forEach((f, i) =>
      setTimeout(() => this._beep(f, 0.12, 0.18, "sine"), i * 80)
    );
  }

  lose() {
    this._beep(200, 0.3, 0.12, "sawtooth");
    setTimeout(() => this._beep(150, 0.4, 0.1, "sawtooth"), 250);
  }

  win() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this._beep(f, 0.18, 0.2, "sine"), i * 120)
    );
  }

  resume() {
    if (this._ctx?.state === "suspended") this._ctx.resume();
  }
}

export const sound = new SoundMgr();