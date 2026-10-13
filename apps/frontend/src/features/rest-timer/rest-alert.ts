// The beep at the rest's end. Browsers only let audio start after a user gesture, so the
// context is created (or resumed) from the click that starts the rest, and reused.

let context: AudioContext | null = null;

export function primeRestAlert() {
    try {
        context ??= new AudioContext();
        if (context.state === 'suspended') void context.resume();
    } catch {
        context = null; // No Web Audio: the end is visual only.
    }
}

/** Two short tones. Silent when audio was never unlocked. */
export function playRestAlert() {
    if (!context || context.state !== 'running') return;
    const start = context.currentTime;
    [0, 0.25].forEach((offset) => {
        const oscillator = context!.createOscillator();
        const gain = context!.createGain();
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, start + offset);
        gain.gain.exponentialRampToValueAtTime(0.3, start + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.18);
        oscillator.connect(gain).connect(context!.destination);
        oscillator.start(start + offset);
        oscillator.stop(start + offset + 0.2);
    });
}
