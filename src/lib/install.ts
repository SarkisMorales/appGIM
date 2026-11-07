// Captura el evento de instalación de la PWA (Chrome/Edge/Android) para ofrecer un botón "Instalar".
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

export function initInstallCapture() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export const getInstallPrompt = () => deferred;

export function onInstallPromptChange(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
