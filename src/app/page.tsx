'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { colorForPercent, formatTime, type UsageData } from '@/lib/types';
import { MASCOT_B64 } from '@/lib/mascot-b64';

function Ico({ d, size = 13, sw = 1.8 }: { d: string | string[]; size?: number; sw?: number }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const ICO = {
  pin:      ['M12 17v5', 'M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v3.76z'],
  refresh:  'M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'],
};

type AppState = 'loading' | 'login' | 'data';

// colour tokens
const C = {
  bg:        'rgba(18,18,22,0.90)',
  border:    'rgba(255,255,255,0.08)',
  divider:   'rgba(255,255,255,0.055)',
  t1:        '#f0f0f2',
  t2:        '#a0a0ab',
  t3:        '#888893',
  accent:    '#d97757',
  accentLo:  'rgba(217,119,87,0.16)',
  green:     '#22c55e',
  orange:    '#f59e0b',
  red:       '#ef4444',
  track:     'rgba(255,255,255,0.08)',
};

// ── Bar ──────────────────────────────────────────────────────────────────────
function UsageBar({ pct, accent }: { pct: number; accent?: boolean }) {
  const p = Math.min(pct, 100);
  const fill = accent ? C.accent : p >= 95 ? C.red : p >= 80 ? C.orange : C.green;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex:1, height:4, borderRadius:99, background:C.track, overflow:'hidden' }}>
        <div style={{
          height:'100%', borderRadius:99,
          width:`${p}%`,
          background: fill,
          boxShadow:`0 0 6px ${fill}55`,
          transition:'width .45s cubic-bezier(.4,0,.2,1)',
        }}/>
      </div>
      <span style={{ fontSize:11, fontWeight:700, color:fill, minWidth:30, textAlign:'right',
                     fontVariantNumeric:'tabular-nums', letterSpacing:'-0.01em' }}>
        {Math.round(p)}%
      </span>
    </div>
  );
}

// ── Usage row ────────────────────────────────────────────────────────────────
function UsageRow({ label, pct, reset, accent }: {
  label: string; pct: number | null; reset: string | null; accent?: boolean;
}) {
  if (pct == null || isNaN(pct)) return null;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
        <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',
                       letterSpacing:'.07em', color:C.t3 }}>{label}</span>
        {reset && (
          <span style={{ fontSize:9, color:C.t3, fontVariantNumeric:'tabular-nums', opacity:.8 }}>
            ↺ {reset}
          </span>
        )}
      </div>
      <UsageBar pct={pct} accent={accent} />
    </div>
  );
}

// ── Icon button ──────────────────────────────────────────────────────────────
function Btn({ onClick, title, active, spin, children }: {
  onClick?: () => void; title?: string; active?: boolean; spin?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: active ? C.accentLo : 'none',
        border: 'none',
        color: active ? C.accent : C.t3,
        fontSize: 13, cursor: 'pointer',
        lineHeight: 1, padding: '4px 5px',
        borderRadius: 6,
        WebkitAppRegion: 'no-drag',
        transition: 'color .15s, background .15s',
        display: 'flex', alignItems: 'center',
        ...(spin ? { animation: 'spin .7s linear infinite' } : {}),
      } as React.CSSProperties}
    >
      {children}
    </button>
  );
}

// ── Main widget ──────────────────────────────────────────────────────────────
export default function Page() {
  const [state, setState]       = useState<AppState>('loading');
  const [data, setData]         = useState<UsageData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pinned, setPinned]     = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (typeof window === 'undefined' || !window.electron) return;
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => window.electron.resizeWidget(el.scrollHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const applyData = useCallback((d: UsageData | null) => {
    if (!d)             { setState('loading'); return; }
    if (!d.isLoggedIn)  { setState('login');   return; }
    setData(d);
    setState('data');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electron) return;
    window.electron.getUsage().then(applyData);
    window.electron.getPrefs().then(p => setPinned(p.alwaysOnTop));
    const off1 = window.electron.on('usage:update',        d  => applyData(d as UsageData));
    const off2 = window.electron.on('usage:loading',       () => setState('loading'));
    const off3 = window.electron.on('always-on-top',       v  => setPinned(v as boolean));
    const off4 = window.electron.on('usage:login-required',() => setState('login'));
    return () => { off1(); off2(); off3(); off4(); };
  }, [applyData]);

  const handleRefresh = useCallback(async () => {
    if (refreshing || !window.electron) return;
    setRefreshing(true);
    try { applyData(await window.electron.refresh()); }
    finally { setRefreshing(false); }
  }, [refreshing, applyData]);

  return (
    <div ref={rootRef} style={{
      width: 252,
      background: C.bg,
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      overflow: 'hidden',
      WebkitMaskImage: '-webkit-radial-gradient(white, black)',
      transform: 'translateZ(0)',
      isolation: 'isolate',
      boxShadow: '0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: C.t1,
      WebkitFontSmoothing: 'antialiased',
    } as React.CSSProperties}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 10px 9px 12px',
        WebkitAppRegion: 'drag',
        cursor: 'grab',
      } as React.CSSProperties}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <img
            src={MASCOT_B64} alt="Claude"
            style={{ width: 18, height: 18, imageRendering: 'pixelated', borderRadius: 4, flexShrink: 0 }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: C.t1, letterSpacing: '-0.02em' }}>
            Claude Usage
          </span>
          {data?.planName && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
              background: C.accentLo, color: C.accent,
              borderRadius: 4, padding: '1px 5px', lineHeight: '14px',
            }}>
              {data.planName}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 1, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <Btn active={pinned} title={pinned ? 'Always on top: on' : 'Always on top: off'}
            onClick={() => { const n = !pinned; setPinned(n); window.electron?.setAlwaysOnTop(n); }}>
            <Ico d={ICO.pin} sw={pinned ? 2.2 : 1.8} />
          </Btn>
          <Btn spin={refreshing} title="Refresh" onClick={handleRefresh}>
            <Ico d={ICO.refresh} />
          </Btn>
          <Btn title="Settings" onClick={() => window.electron?.openSettings()}>
            <Ico d={ICO.settings} />
          </Btn>
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: C.divider }} />

      {/* ── Loading ── */}
      {state === 'loading' && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:'22px 16px' }}>
          <div style={{
            width: 20, height: 20,
            border: `2px solid ${C.track}`,
            borderTopColor: C.accent,
            borderRadius: '50%',
            animation: 'spin .8s linear infinite',
          }} />
          <span style={{ color: C.t3, fontSize: 11 }}>Fetching…</span>
        </div>
      )}

      {/* ── Login ── */}
      {state === 'login' && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, padding:'20px 16px' }}>
          <img
            src={MASCOT_B64} alt="Claude"
            style={{ width: 40, height: 40, imageRendering: 'pixelated', borderRadius: 10 }}
          />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.t1, margin: 0 }}>Sign in to Claude</p>
            <p style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>to see your usage</p>
          </div>
          <button
            onClick={() => window.electron?.openLogin()}
            style={{
              background: C.accent, color: '#fff', border: 'none',
              borderRadius: 8, padding: '7px 22px',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              letterSpacing: '-0.01em',
            }}
          >
            Sign in
          </button>
        </div>
      )}

      {/* ── Data ── */}
      {state === 'data' && data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 13px' }}>

          <UsageRow label="Session"      pct={data.sessionPercent}         reset={data.sessionResetTime}     />
          <UsageRow label="Weekly"       pct={data.weeklyAllModelsPercent} reset={data.weeklyAllModelsReset} />
          <UsageRow label="Sonnet"       pct={data.weeklySonnetPercent}    reset={data.weeklySonnetReset}    />
          <UsageRow label="Claude Design" pct={data.claudeDesignPercent}   reset={data.claudeDesignReset}    />
          <UsageRow label="Extra"        pct={data.extraPercent}           reset={data.extraReset} accent    />

          {/* Money row */}
          {(data.extraSpent !== null || data.extraBalance !== null) && (
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '8px 10px', marginTop: 2,
              background: 'rgba(217,119,87,0.07)',
              borderRadius: 9,
              border: `1px solid rgba(217,119,87,0.13)`,
            }}>
              {data.extraSpent !== null && (
                <MoneyCell label="Spent" value={`$${data.extraSpent.toFixed(2)}`} />
              )}
              {data.extraLimit !== null && (
                <MoneyCell label="Limit" value={`$${data.extraLimit.toFixed(2)}`} />
              )}
              {data.extraBalance !== null && (
                <MoneyCell
                  label="Balance"
                  value={`$${data.extraBalance.toFixed(2)}`}
                  color={data.extraBalance >= 0 ? C.green : C.red}
                />
              )}
            </div>
          )}

          {/* Context warning */}
          {data.sessionPercent !== null && data.sessionPercent >= 80 && (
            <ContextWarning pct={data.sessionPercent} reset={data.sessionResetTime} />
          )}

          {/* Footer */}
          <div style={{ height: 1, background: C.divider }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: C.t3, fontVariantNumeric: 'tabular-nums', opacity: .65 }}>
              {data.lastUpdated ? `Updated ${formatTime(data.lastUpdated)}` : ''}
            </span>
            <button
              style={{
                background: 'none', border: 'none', color: C.t3,
                fontSize: 9, cursor: 'pointer', padding: '2px 4px',
                borderRadius: 4, opacity: .7,
              }}
              onClick={() => window.electron?.signOut()}
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        button:hover { opacity: .8 !important; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

function ContextWarning({ pct, reset }: { pct: number; reset: string | null }) {
  const remaining = Math.round(100 - pct);
  const isMaxed = remaining <= 0;
  const isCritical = remaining <= 5;
  const color = isCritical ? C.red : C.orange;
  const subtitle = reset ? `Resets ${reset}.` : 'Session limit approaching.';
  return (
    <div style={{
      borderRadius: 8,
      background: isCritical ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
      border: `1px solid ${isCritical ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
      padding: '7px 10px',
      display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, color, lineHeight: 1.4 }}>
        {isMaxed
          ? 'Session limit reached — auto-compact active.'
          : `${remaining}% of context remaining until auto-compact.`}
      </span>
      <span style={{ fontSize: 9, color: C.t3, lineHeight: 1.4 }}>
        {subtitle}
      </span>
    </div>
  );
}

function MoneyCell({ label, value, color = C.t2 }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: C.t3 }}>
        {label}
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  );
}
