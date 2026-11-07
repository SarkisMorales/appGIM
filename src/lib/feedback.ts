// Sonidos (Web Audio), vibración y voz (Web Speech API): todo nativo del navegador y gratis.
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Llamar desde un gesto del usuario (iOS necesita "desbloquear" el audio). */
export function unlockAudio() {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  g.gain.value = 0.0001;
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.01);
}

export function beep(freq = 880, ms = 140, volume = 0.18) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  const t = a.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + ms / 1000 + 0.02);
}

export function chime() {
  beep(660, 140);
  setTimeout(() => beep(880, 140), 150);
  setTimeout(() => beep(1175, 260), 300);
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* sin soporte */
  }
}

let voiceEs: SpeechSynthesisVoice | null | undefined;
function pickVoice(): SpeechSynthesisVoice | null {
  if (voiceEs !== undefined) return voiceEs;
  const voices = window.speechSynthesis?.getVoices?.() || [];
  voiceEs =
    voices.find((v) => /es[-_](AR|UY)/i.test(v.lang)) ||
    voices.find((v) => /es[-_](419|MX|US|CO|CL)/i.test(v.lang)) ||
    voices.find((v) => /^es/i.test(v.lang)) ||
    null;
  if (!voices.length) voiceEs = undefined;
  return voiceEs ?? null;
}

export function speak(text: string) {
  try {
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-AR';
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 1.03;
    s.speak(u);
  } catch {
    /* sin soporte */
  }
}
