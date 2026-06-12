/**
 * Programmatic Web Audio API Synthesizer
 * Generates beautiful, light, high-fidelity notification chime sounds
 * completely server-free with zero network latency.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    // Standard and vendor-prefixed AudioContext support
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a light, warm, high-pitched double-tap chime for incoming chat messages
 */
export function playMessageChime() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Double chime taps
    const taps = [
      { time: now, freq: 880 },       // A5
      { time: now + 0.08, freq: 1174.66 } // D6
    ];

    taps.forEach((tap) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      // Soft triangle/sine wave mixture for a pure digital tone
      osc.type = "sine";
      osc.frequency.setValueAtTime(tap.freq, tap.time);
      
      // Fast exponential attack and gentle decay
      gainNode.gain.setValueAtTime(0, tap.time);
      gainNode.gain.linearRampToValueAtTime(0.08, tap.time + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, tap.time + 0.55);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(tap.time);
      osc.stop(tap.time + 0.6);
    });
  } catch (err) {
    console.warn("Audio Context is blocked or not sustained on this browser yet:", err);
  }
}

/**
 * Play a pleasant, comforting ascending major triad chime for a participant joining the session
 */
export function playJoinChime() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Ascending warm major scale notes: C5 -> E5 -> G5 -> C6
    const notes = [
      { offset: 0.0, freq: 523.25 },  // C5
      { offset: 0.07, freq: 659.25 }, // E5
      { offset: 0.14, freq: 783.99 }, // G5
      { offset: 0.22, freq: 1046.50 } // C6
    ];

    notes.forEach((note) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      // Cozy sine tone
      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, now + note.offset);

      // Fast slide-in, warm release
      gainNode.gain.setValueAtTime(0, now + note.offset);
      gainNode.gain.linearRampToValueAtTime(0.07, now + note.offset + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + note.offset + 0.6);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + note.offset);
      osc.stop(now + note.offset + 0.7);
    });
  } catch (err) {
    console.warn("Audio Context is blocked or not sustained on this browser yet:", err);
  }
}
