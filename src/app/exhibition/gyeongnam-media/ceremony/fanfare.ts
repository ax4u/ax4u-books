// Original short fanfare, synthesized here; no recording or external melody.
// The same score can run in OfflineAudioContext for a reproducible waveform check.
export function fanfare(context: BaseAudioContext, output: AudioNode) {
  const start = context.currentTime + 0.04;
  const score = [[0, 0.22, 60], [0.28, 0.22, 60], [0.56, 0.38, 67], [1.02, 0.4, 64], [1.5, 0.5, 69], [2.08, 0.38, 67], [2.55, 0.38, 71], [3.05, 1.65, 72]];
  const nodes: OscillatorNode[] = [];
  for (const [offset, duration, pitch] of score) {
    for (const interval of [0, -12, -24]) {
      const oscillator = context.createOscillator();
      const filter = context.createBiquadFilter();
      const envelope = context.createGain();
      const time = start + offset;
      oscillator.type = 'sawtooth';
      oscillator.frequency.value = 440 * 2 ** ((pitch + interval - 69) / 12);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, time);
      filter.frequency.linearRampToValueAtTime(2800, time + 0.045);
      filter.frequency.exponentialRampToValueAtTime(700, time + duration);
      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(0.12, time + 0.025);
      envelope.gain.exponentialRampToValueAtTime(0.065, time + duration * 0.65);
      envelope.gain.linearRampToValueAtTime(0, time + duration);
      oscillator.connect(filter).connect(envelope).connect(output);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.02);
      oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); envelope.disconnect(); };
      nodes.push(oscillator);
    }
  }
  return nodes;
}
