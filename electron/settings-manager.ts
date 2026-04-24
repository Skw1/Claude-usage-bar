import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { AppSettings } from '../src/lib/types';

const DEFAULTS: AppSettings = {
  refreshIntervalMinutes: 5,
  notifyAt80: true,
  notifyAt95: true,
  launchAtStartup: false,
};

export class SettingsManager {
  private readonly filePath: string;
  private data: AppSettings;

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'settings.json');
    this.data = this.load();
  }

  private load(): AppSettings {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  get(): AppSettings {
    return { ...this.data };
  }

  save(partial: Partial<AppSettings>): AppSettings {
    this.data = { ...this.data, ...partial };
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch { /* */ }
    return { ...this.data };
  }
}
