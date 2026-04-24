import { BrowserWindow, session } from 'electron';
import { EventEmitter } from 'events';
import type { UsageData } from '../src/lib/types';

const SESSION_PARTITION = 'persist:claude-usage';
const USAGE_URL = 'https://claude.ai/settings/usage';
const LOGIN_URL = 'https://claude.ai/login';
const PAGE_SETTLE_MS = 5000;
const FETCH_TIMEOUT_MS = 30_000;

// Injected into the hidden claude.ai window to parse usage stats from the DOM
const EXTRACTOR_SCRIPT = `
(function extractUsage() {
  try {
    function pct(text) {
      const m = String(text ?? '').match(/(\\d+(?:\\.\\d+)?)%/);
      return m ? parseFloat(m[1]) : null;
    }
    function money(text) {
      const m = String(text ?? '').match(/\\$([\\d,]+(?:\\.\\d+)?)/);
      return m ? parseFloat(m[1].replace(',', '')) : null;
    }

    // --- Progress bars (multiple selector strategies) ---
    const barSelectors = [
      '[role="progressbar"]',
      '[aria-valuenow]',
      '[aria-valuetext*="%"]',
      'progress',
    ];
    let bars = [];
    for (const sel of barSelectors) {
      bars = [...document.querySelectorAll(sel)];
      if (bars.length > 0) break;
    }

    let barValues = bars.map(b => {
      const raw = b.getAttribute('aria-valuenow')
               ?? b.getAttribute('aria-valuetext')
               ?? b.getAttribute('value')
               ?? '';
      return pct(raw) ?? (parseFloat(raw) || null);
    }).filter(v => v !== null);

    // --- Page text fallback ---
    const pageText = document.body ? document.body.innerText : '';

    // Percent patterns: "72%" or "72% used" or "used 72%"
    const pctPatterns = [
      /(\\d+(?:\\.\\d+)?)%\\s*used/gi,
      /used\\s+(\\d+(?:\\.\\d+)?)%/gi,
      /(\\d+(?:\\.\\d+)?)%\\s*(?:of|complete|consumed)/gi,
    ];
    let usedMatches = [];
    for (const pattern of pctPatterns) {
      const found = [...pageText.matchAll(pattern)].map(m => parseFloat(m[1]));
      if (found.length > usedMatches.length) usedMatches = found;
    }

    // If progress bars gave nothing, try inline style width percentages
    if (barValues.length === 0) {
      const styledEls = [...document.querySelectorAll('[style*="width"]')];
      const widthPcts = styledEls
        .map(el => { const m = el.style.width.match(/(\\d+(?:\\.\\d+)?)%/); return m ? parseFloat(m[1]) : null; })
        .filter(v => v !== null && v > 0 && v <= 100);
      if (widthPcts.length > 0) barValues = widthPcts;
    }

    const percents = barValues.length >= usedMatches.length ? barValues : usedMatches;

    // --- Reset times ---
    const resetPatterns = [
      /resets?\\s+in\\s+([\\w\\s,]+?)(?:\\.|\\n|$)/gi,
      /resets?\\s+([\\w\\s,]+?)(?:\\.|\\n|$)/gi,
      /in\\s+(\\d+\\s+(?:hour|day|week|minute)[s\\w]*)/gi,
    ];
    let resetMatches = [];
    for (const pattern of resetPatterns) {
      const found = [...pageText.matchAll(pattern)].map(m => m[1].trim());
      if (found.length > resetMatches.length) resetMatches = found;
    }

    // --- Money ---
    const spentM   = pageText.match(/\\$(\\d+(?:\\.\\d+)?)\\s+(?:spent|used)/i);
    const limitM   = pageText.match(/limit[:\\s]+\\$(\\d+(?:\\.\\d+)?)/i)
                  ?? pageText.match(/\\$(\\d+(?:\\.\\d+)?)\\s+(?:limit)/i);
    const balanceM = pageText.match(/balance[:\\s]+\\$(\\d+(?:\\.\\d+)?)/i)
                  ?? pageText.match(/\\$(\\d+(?:\\.\\d+)?)\\s+(?:balance|remaining)/i);

    // --- Claude Design — detect by label text proximity ---
    let claudeDesignPct = null;
    let claudeDesignReset = null;
    const allEls = [...document.querySelectorAll('*')];
    const designEl = allEls.find(el =>
      el.children.length === 0 && /claude\\s+design/i.test(el.textContent ?? '')
    );
    if (designEl) {
      // Walk up to find a container that has a progressbar inside
      let node = designEl.parentElement;
      for (let i = 0; i < 6 && node; i++) {
        const bar = node.querySelector('[role="progressbar"], progress, [aria-valuenow]');
        if (bar) {
          const raw = bar.getAttribute('aria-valuenow') ?? bar.getAttribute('aria-valuetext') ?? '';
          claudeDesignPct = pct(raw) ?? (parseFloat(raw) || null);
          const txt = node.innerText ?? '';
          const rm = txt.match(/resets?\\s+in\\s+([\\w\\s,]+?)(?:\\.|\\n|$)/i);
          claudeDesignReset = rm ? rm[1].trim() : null;
          break;
        }
        node = node.parentElement;
      }
      // Fallback: look for "X% used" near the element
      if (claudeDesignPct === null) {
        const container = designEl.closest('section, [class*="usage"], [class*="card"], div') ?? designEl.parentElement;
        if (container) {
          const txt = (container && container.innerText) || '';
          const m = txt.match(/(\\d+(?:\\.\\d+)?)%/);
          if (m) claudeDesignPct = parseFloat(m[1]);
        }
      }
    }

    return JSON.stringify({
      sessionPercent:          percents[0] ?? null,
      sessionResetTime:        resetMatches[0] ?? null,
      weeklyAllModelsPercent:  percents[1] ?? null,
      weeklyAllModelsReset:    resetMatches[1] ?? null,
      weeklySonnetPercent:     percents[2] ?? null,
      weeklySonnetReset:       resetMatches[2] ?? null,
      extraPercent:            percents[3] ?? null,
      extraReset:              resetMatches[3] ?? null,
      claudeDesignPercent:     claudeDesignPct,
      claudeDesignReset:       claudeDesignReset,
      extraSpent:   spentM   ? parseFloat(spentM[1])   : null,
      extraLimit:   limitM   ? money(limitM[0])         : null,
      extraBalance: balanceM ? money(balanceM[0])       : null,
      _debug: { barCount: bars.length, percents, claudeDesignPct, pageLen: pageText.length },
    });
  } catch (e) {
    return JSON.stringify({ _error: String(e) });
  }
})()
`;

function emptyData(overrides: Partial<UsageData> = {}): UsageData {
  return {
    sessionPercent: null,
    sessionResetTime: null,
    weeklyAllModelsPercent: null,
    weeklyAllModelsReset: null,
    weeklySonnetPercent: null,
    weeklySonnetReset: null,
    extraSpent: null,
    extraLimit: null,
    extraBalance: null,
    extraPercent: null,
    extraReset: null,
    claudeDesignPercent: null,
    claudeDesignReset: null,
    isLoggedIn: true,
    error: null,
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

export class UsageScraper extends EventEmitter {
  private scraperWin: BrowserWindow | null = null;
  private loginWin: BrowserWindow | null = null;
  private lastData: UsageData | null = null;

  async init(): Promise<void> {
    this.scraperWin = new BrowserWindow({
      show: false,
      width: 1280,
      height: 800,
      webPreferences: {
        session: session.fromPartition(SESSION_PARTITION),
        javascript: true,
        images: false,
      },
    });

    this.scraperWin.webContents.session.setCertificateVerifyProc((_req, cb) => cb(0));
  }

  async fetchUsage(): Promise<UsageData> {
    if (!this.scraperWin || this.scraperWin.isDestroyed()) {
      await this.init();
    }
    const win = this.scraperWin!;

    return new Promise<UsageData>((resolve) => {
      let settled = false;
      const done = (data: UsageData) => {
        if (settled) return;
        settled = true;
        this.lastData = data;
        resolve(data);
      };

      const timeout = setTimeout(() => {
        done(emptyData({ error: 'Request timed out' }));
      }, FETCH_TIMEOUT_MS);

      win.webContents.once('did-finish-load', async () => {
        clearTimeout(timeout);
        const url = win.webContents.getURL();

        if (isLoginUrl(url)) {
          done(emptyData({ isLoggedIn: false }));
          return;
        }

        await sleep(PAGE_SETTLE_MS);

        if (isLoginUrl(win.webContents.getURL())) {
          done(emptyData({ isLoggedIn: false }));
          return;
        }

        try {
          const raw = await win.webContents.executeJavaScript(EXTRACTOR_SCRIPT);
          const parsed = JSON.parse(raw);

          if (parsed._error) {
            console.error('[scraper] extractor error:', parsed._error);
            done(emptyData({ error: parsed._error }));
            return;
          }

          console.log('[scraper] debug:', JSON.stringify(parsed._debug));

          done({
            sessionPercent:         parsed.sessionPercent,
            sessionResetTime:       parsed.sessionResetTime,
            weeklyAllModelsPercent: parsed.weeklyAllModelsPercent,
            weeklyAllModelsReset:   parsed.weeklyAllModelsReset,
            weeklySonnetPercent:    parsed.weeklySonnetPercent,
            weeklySonnetReset:      parsed.weeklySonnetReset,
            extraSpent:             parsed.extraSpent,
            extraLimit:             parsed.extraLimit,
            extraBalance:           parsed.extraBalance,
            extraPercent:           parsed.extraPercent,
            extraReset:             parsed.extraReset,
            claudeDesignPercent:    parsed.claudeDesignPercent ?? null,
            claudeDesignReset:      parsed.claudeDesignReset   ?? null,
            isLoggedIn: true,
            error: null,
            lastUpdated: new Date().toISOString(),
          });
        } catch (e) {
          done(emptyData({ error: String(e) }));
        }
      });

      win.loadURL(USAGE_URL);
    });
  }

  getLastData(): UsageData | null {
    return this.lastData;
  }

  async clearSession(): Promise<void> {
    const ses = session.fromPartition(SESSION_PARTITION);
    await ses.clearStorageData({ storages: ['cookies', 'localstorage', 'cachestorage'] });
    this.lastData = null;
  }

  showLoginWindow(): void {
    if (this.loginWin && !this.loginWin.isDestroyed()) {
      this.loginWin.focus();
      return;
    }

    this.loginWin = new BrowserWindow({
      width: 480,
      height: 660,
      title: 'Sign in to Claude',
      resizable: false,
      center: true,
      webPreferences: {
        session: session.fromPartition(SESSION_PARTITION),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    let loginSettled = false;

    const handleLoginSuccess = () => {
      if (loginSettled) return;
      loginSettled = true;
      // Hide immediately — before any chat page can render
      if (this.loginWin && !this.loginWin.isDestroyed()) {
        this.loginWin.hide();
      }
      this.emit('login-success');
      setTimeout(() => {
        if (this.loginWin && !this.loginWin.isDestroyed()) {
          this.loginWin.close();
        }
        this.loginWin = null;
      }, 100);
    };

    // Catch JS-initiated navigations (e.g. window.location.href change)
    this.loginWin.webContents.on('will-navigate', (event, url) => {
      if (!isLoginUrl(url) && url.startsWith('https://claude.ai')) {
        event.preventDefault();
        handleLoginSuccess();
      }
    });

    // Catch HTTP redirects — hide immediately as navigation starts
    this.loginWin.webContents.on('did-start-navigation', (_e, url, _isInPlace, isMainFrame) => {
      if (!isMainFrame) return;
      if (!isLoginUrl(url) && url.startsWith('https://claude.ai')) {
        if (this.loginWin && !this.loginWin.isDestroyed()) {
          this.loginWin.hide();
        }
      }
    });

    // Final catch-all for any navigation that slipped through
    this.loginWin.webContents.on('did-navigate', (_e, url) => {
      if (!isLoginUrl(url) && url.startsWith('https://claude.ai')) {
        handleLoginSuccess();
      }
    });

    this.loginWin.on('closed', () => {
      this.loginWin = null;
    });

    this.loginWin.loadURL(LOGIN_URL);
    this.loginWin.show();
  }

  destroy(): void {
    if (this.scraperWin && !this.scraperWin.isDestroyed()) this.scraperWin.destroy();
    if (this.loginWin && !this.loginWin.isDestroyed()) this.loginWin.destroy();
  }
}

function isLoginUrl(url: string): boolean {
  return url.includes('/login') || url.includes('/oauth') || url.includes('/auth');
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
