export interface UsageData {
  sessionPercent: number | null;
  sessionResetTime: string | null;
  weeklyAllModelsPercent: number | null;
  weeklyAllModelsReset: string | null;
  weeklySonnetPercent: number | null;
  weeklySonnetReset: string | null;
  extraSpent: number | null;
  extraLimit: number | null;
  extraBalance: number | null;
  extraPercent: number | null;
  extraReset: string | null;
  claudeDesignPercent: number | null;
  claudeDesignReset: string | null;
  isLoggedIn: boolean;
  error: string | null;
  lastUpdated: string;
}

export interface AppSettings {
  refreshIntervalMinutes: number;
  notifyAt80: boolean;
  notifyAt95: boolean;
  launchAtStartup: boolean;
}

export type UsageColor = 'green' | 'orange' | 'red';

export function colorForPercent(pct: number): UsageColor {
  if (pct >= 95) return 'red';
  if (pct >= 80) return 'orange';
  return 'green';
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

declare global {
  interface Window {
    electron: {
      getUsage:       () => Promise<UsageData | null>;
      refresh:        () => Promise<UsageData | null>;
      getPrefs:       () => Promise<{ alwaysOnTop: boolean }>;
      openLogin:      () => void;
      openSettings:   () => void;
      resizeWidget:   (h: number) => void;
      setAlwaysOnTop: (v: boolean) => void;
      signOut:        () => void;
      on: (channel: string, cb: (...args: unknown[]) => void) => () => void;
    };
    electronSettings: {
      getSettings:  () => Promise<AppSettings>;
      saveSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>;
      close:        () => void;
      signOut:      () => void;
    };
  }
}
