import type { MutableRefObject } from "react";

export function playSlimeClickSound(audioContextRef: MutableRefObject<AudioContext | null>) {
  if (typeof window === "undefined") return;
  try {
    const AudioContextCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = audioContextRef.current ?? new AudioContextCtor();
    audioContextRef.current = context;
    if (context.state === "suspended") {
      void context.resume();
    }

    const now = context.currentTime;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-24, now);
    compressor.knee.setValueAtTime(18, now);
    compressor.ratio.setValueAtTime(3.2, now);
    compressor.attack.setValueAtTime(0.003, now);
    compressor.release.setValueAtTime(0.11, now);

    const toneFilter = context.createBiquadFilter();
    toneFilter.type = "lowpass";
    toneFilter.frequency.setValueAtTime(1800, now);
    toneFilter.Q.setValueAtTime(0.65, now);

    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.118, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.29);
    master.connect(toneFilter);
    toneFilter.connect(compressor);
    compressor.connect(context.destination);

    const bodyOsc = context.createOscillator();
    bodyOsc.type = "triangle";
    bodyOsc.frequency.setValueAtTime(255, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(145, now + 0.22);
    const bodyGain = context.createGain();
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.86, now + 0.016);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(master);

    const springOsc = context.createOscillator();
    springOsc.type = "sine";
    springOsc.frequency.setValueAtTime(205, now + 0.02);
    springOsc.frequency.linearRampToValueAtTime(248, now + 0.075);
    springOsc.frequency.exponentialRampToValueAtTime(178, now + 0.2);
    const springGain = context.createGain();
    springGain.gain.setValueAtTime(0.0001, now + 0.02);
    springGain.gain.exponentialRampToValueAtTime(0.52, now + 0.055);
    springGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    springOsc.connect(springGain);
    springGain.connect(master);

    const popOsc = context.createOscillator();
    popOsc.type = "sine";
    popOsc.frequency.setValueAtTime(390, now + 0.018);
    popOsc.frequency.exponentialRampToValueAtTime(220, now + 0.14);
    const popGain = context.createGain();
    popGain.gain.setValueAtTime(0.0001, now + 0.018);
    popGain.gain.exponentialRampToValueAtTime(0.22, now + 0.038);
    popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    popOsc.connect(popGain);
    popGain.connect(master);

    bodyOsc.start(now);
    bodyOsc.stop(now + 0.25);
    springOsc.start(now + 0.02);
    springOsc.stop(now + 0.22);
    popOsc.start(now + 0.018);
    popOsc.stop(now + 0.15);
  } catch {
    // Keep interaction stable when audio API is unavailable.
  }
}
