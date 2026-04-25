import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings } from '../src/lib/types';

contextBridge.exposeInMainWorld('electronSettings', {
  getAccountInfo: (): Promise<{ email: string | null; planName: string | null }> =>
    ipcRenderer.invoke('settings:account-info'),

  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:get'),

  saveSettings: (partial: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:save', partial),

  close: (): void =>
    ipcRenderer.send('settings:close'),

  signOut: (): void =>
    ipcRenderer.send('sign-out'),
});
