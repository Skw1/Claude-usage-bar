'use client';

import { useEffect, useRef, useState } from 'react';
import { MASCOT_B64 } from '@/lib/mascot-b64';
import type { AppSettings } from '@/lib/types';

const VERSION = '1.0.2';

const INTERVALS = [
  { label: '1 minute',   value: 1  },
  { label: '5 minutes',  value: 5  },
  { label: '10 minutes', value: 10 },
  { label: '30 minutes', value: 30 },
];

type Tab = 'general' | 'notifications' | 'account' | 'about';

function Icon({ d, size = 15, sw = 1.8 }: { d: string; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  bell:     'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  user:     'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  info:     'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 16v-4 M12 8h.01',
};

const NAV: { id: Tab; label: string; iconKey: keyof typeof ICONS }[] = [
  { id: 'general',       label: 'General',       iconKey: 'settings' },
  { id: 'notifications', label: 'Notifications', iconKey: 'bell'     },
  { id: 'account',       label: 'Account',       iconKey: 'user'     },
  { id: 'about',         label: 'About',         iconKey: 'info'     },
];

// ── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        flexShrink: 0,
        width: 38,
        height: 22,
        borderRadius: 11,
        border: 'none',
        background: checked ? '#d97757' : 'rgba(255,255,255,0.12)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background .2s ease',
        outline: 'none',
      }}
    >
      <span style={{
        position: 'absolute',
        top: 3,
        left: checked ? 19 : 3,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
        transition: 'left .2s ease',
        display: 'block',
      }} />
    </button>
  );
}

// ── Setting row ──────────────────────────────────────────────────────────────
function Row({ label, sublabel, last, children }: {
  label: string;
  sublabel?: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.05)',
      gap: 16,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: '#f4f4f5', margin: 0 }}>{label}</p>
        {sublabel && (
          <p style={{ fontSize: 11, color: '#71717a', margin: '2px 0 0', lineHeight: 1.4 }}>{sublabel}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Section group ────────────────────────────────────────────────────────────
function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {title && (
        <p style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '.09em', color: '#71717a',
          margin: '0 0 8px 2px',
        }}>
          {title}
        </p>
      )}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.07)',
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
function TabGeneral({ s, update }: { s: AppSettings; update: (p: Partial<AppSettings>) => void }) {
  return (
    <div>
      <Group title="Behavior">
        <Row label="Launch at startup" sublabel="Open automatically when you log in">
          <Toggle checked={s.launchAtStartup} onChange={v => update({ launchAtStartup: v })} />
        </Row>
        <Row label="Refresh interval" sublabel="How often usage is fetched" last>
          <select
            value={s.refreshIntervalMinutes}
            onChange={e => update({ refreshIntervalMinutes: Number(e.target.value) })}
            style={{
              background: '#2a2a30', border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 7, color: '#f4f4f5', fontSize: 12,
              padding: '5px 10px', cursor: 'pointer', outline: 'none',
            }}
          >
            {INTERVALS.map(i => (
              <option key={i.value} value={i.value} style={{ background: '#1e1e24' }}>
                {i.label}
              </option>
            ))}
          </select>
        </Row>
      </Group>
    </div>
  );
}

function TabNotifications({ s, update }: { s: AppSettings; update: (p: Partial<AppSettings>) => void }) {
  return (
    <div>
      <Group title="Usage alerts">
        <Row label="Warn at 80%" sublabel="Alert when session usage hits 80%">
          <Toggle checked={s.notifyAt80} onChange={v => update({ notifyAt80: v })} />
        </Row>
        <Row label="Warn at 95%" sublabel="Alert when session is nearly full" last>
          <Toggle checked={s.notifyAt95} onChange={v => update({ notifyAt95: v })} />
        </Row>
      </Group>
    </div>
  );
}

function TabAccount() {
  const [info, setInfo] = useState<{ email: string | null; planName: string | null }>({ email: null, planName: null });

  useEffect(() => {
    window.electronSettings?.getAccountInfo().then(setInfo).catch(() => {});
  }, []);

  return (
    <div>
      <Group title="Account">
        <InfoRow label="Auth method" value="Claude AI" />
        <InfoRow label="Email"       value={info.email ?? '—'} mono />
        <InfoRow label="Plan"        value={info.planName ?? '—'} last />
      </Group>
      <Group title="Session">
        <Row label="Sign out" sublabel="Clear your session and disconnect" last>
          <button
            onClick={() => {
              window.electronSettings?.signOut();
              window.electronSettings?.close();
            }}
            style={{
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.20)',
              borderRadius: 7, color: '#ef4444',
              fontSize: 12, fontWeight: 600,
              padding: '6px 14px', cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </Row>
      </Group>
    </div>
  );
}

function InfoRow({ label, value, mono, last }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 16px',
      borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.05)',
    }}>
      <span style={{ fontSize: 13, color: '#a1a1aa' }}>{label}</span>
      <span style={{
        fontSize: 13, color: '#f4f4f5',
        fontFamily: mono ? 'monospace' : 'inherit',
        maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
    </div>
  );
}

function TabAbout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 20 }}>
      <img
        src={MASCOT_B64}
        alt="Claude mascot"
        style={{ width: 72, height: 72, imageRendering: 'pixelated', borderRadius: 16 }}
      />
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#f4f4f5', margin: 0 }}>Claude Usage Bar</p>
        <p style={{ fontSize: 12, color: '#71717a', margin: '4px 0 0' }}>Version {VERSION}</p>
      </div>
      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 10, padding: '12px 20px', textAlign: 'center', width: '100%',
      }}>
        <p style={{ fontSize: 11, color: '#a1a1aa', lineHeight: 1.7, margin: 0 }}>
          MIT License · Open Source<br/>
          Not affiliated with Anthropic<br/>
          Claude is a trademark of Anthropic PBC
        </p>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general');
  const [s, setS] = useState<AppSettings>({
    refreshIntervalMinutes: 5,
    notifyAt80: true,
    notifyAt95: true,
    launchAtStartup: false,
  });
  const [ready, setReady] = useState(true);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.body.style.cssText = 'background:#18181b;margin:0;overflow:hidden;height:100vh;';
    if (typeof window === 'undefined' || !window.electronSettings) return;
    window.electronSettings.getSettings().then(setS).catch(() => {});
  }, []);

  const update = async (partial: Partial<AppSettings>) => {
    if (!window.electronSettings) return;
    const next = await window.electronSettings.saveSettings(partial);
    setS(next);
    setSaved(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#18181b', color: '#f4f4f5',
      WebkitFontSmoothing: 'antialiased', userSelect: 'none',
    }}>
      {/* ── Sidebar ── */}
      <div style={{
        width: 200, flexShrink: 0,
        background: '#1c1c22',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        padding: '16px 8px',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '6px 10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          marginBottom: 10,
        }}>
          <img
            src={MASCOT_B64}
            alt="mascot"
            style={{ width: 28, height: 28, imageRendering: 'pixelated', borderRadius: 7 }}
          />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f4f4f5', letterSpacing: '-0.01em' }}>
            Settings
          </span>
        </div>

        {/* Nav items */}
        {NAV.map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', margin: '1px 0',
              borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === item.id ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: tab === item.id ? '#f4f4f5' : '#a1a1aa',
              fontSize: 13, fontWeight: tab === item.id ? 600 : 400,
              textAlign: 'left', width: '100%',
              transition: 'background .15s ease, color .15s ease',
            }}
          >
            <Icon d={ICONS[item.iconKey]} sw={tab === item.id ? 2.2 : 1.8} />
            {item.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'hidden auto', padding: '20px 20px' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#f4f4f5', margin: 0, letterSpacing: '-0.02em' }}>
              {NAV.find(n => n.id === tab)?.label}
            </h1>
            <p style={{ fontSize: 11, color: '#71717a', margin: '3px 0 0' }}>
              {tab === 'general'       && 'Configure how Claude Usage Bar behaves.'}
              {tab === 'notifications' && 'Control when you receive usage alerts.'}
              {tab === 'account'       && 'Manage your Claude session.'}
              {tab === 'about'         && 'About this application.'}
            </p>
          </div>
          <span style={{
            fontSize: 11, color: '#22c55e', fontWeight: 600,
            opacity: saved ? 1 : 0, transition: 'opacity .2s ease',
          }}>
            ✓ Saved
          </span>
        </div>

        {/* Tab content — render immediately with defaults, update when IPC responds */}
        {!ready ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
            <div style={{
              width: 22, height: 22,
              border: '2px solid rgba(255,255,255,0.08)',
              borderTopColor: '#d97757',
              borderRadius: '50%',
              animation: 'spin .8s linear infinite',
            }} />
          </div>
        ) : (
          <>
            {tab === 'general'       && <TabGeneral s={s} update={update} />}
            {tab === 'notifications' && <TabNotifications s={s} update={update} />}
            {tab === 'account'       && <TabAccount />}
            {tab === 'about'         && <TabAbout />}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        button:hover { opacity: 0.85; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>
    </div>
  );
}
