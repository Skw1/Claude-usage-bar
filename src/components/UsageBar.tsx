import type { UsageColor } from '@/lib/types';

interface Props {
  percent: number;
  color: UsageColor;
  accent?: boolean;
}

const BAR_COLOR: Record<UsageColor, string> = {
  green:  '#22c55e',
  orange: '#f59e0b',
  red:    '#ef4444',
};

export default function UsageBar({ percent, color, accent = false }: Props) {
  const fill = accent ? 'var(--accent)' : BAR_COLOR[color];
  const clamped = Math.min(Math.max(percent, 0), 100);

  return (
    <div style={styles.root}>
      <div style={styles.track}>
        <div
          style={{
            ...styles.fill,
            width: `${clamped}%`,
            background: fill,
            boxShadow: `0 0 6px ${fill}55`,
          }}
        />
      </div>
      <span style={{ ...styles.label, color: fill }}>{Math.round(percent)}%</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  track: {
    flex: 1,
    height: '6px',
    borderRadius: '999px',
    background: 'var(--bar-track)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: '999px',
    transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
  },
  label: {
    flexShrink: 0,
    fontSize: '11px',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    minWidth: '30px',
    textAlign: 'right',
  },
};
