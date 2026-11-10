import { exportState, useStore } from '../store/useStore.ts';
import { todayISO } from './dates.ts';

/** Descarga un archivo .json con todos tus datos y anota la fecha del backup. */
export function downloadBackup() {
  const blob = new Blob([exportState()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `appgim-backup-${todayISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  useStore.getState().markBackup();
}
