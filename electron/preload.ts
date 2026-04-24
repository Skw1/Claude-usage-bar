import { contextBridge, ipcRenderer } from 'electron';

type IpcListener = (...args: unknown[]) => void;

contextBridge.exposeInMainWorld('electron', {
  getUsage:       () => ipcRenderer.invoke('get-usage'),
  refresh:        () => ipcRenderer.invoke('refresh'),
  getPrefs:       () => ipcRenderer.invoke('get-prefs'),
  openLogin:      () => ipcRenderer.send('open-login'),
  openSettings:   () => ipcRenderer.send('open-settings'),
  resizeWidget:   (h: number) => ipcRenderer.send('widget-resize', h),
  setAlwaysOnTop: (v: boolean) => ipcRenderer.send('set-always-on-top', v),
  signOut:        () => ipcRenderer.send('sign-out'),

  on(channel: string, cb: IpcListener): () => void {
    const allowed = ['usage:update', 'usage:loading', 'always-on-top', 'usage:login-required'];
    if (!allowed.includes(channel)) return () => {};
    const handler = (_e: Electron.IpcRendererEvent, ...args: unknown[]) => cb(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});
