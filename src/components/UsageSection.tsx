import type { UsageColor } from '@/lib/types';
import UsageBar from './UsageBar';

interface Props {
  title: string;
  percent: number;
  color: UsageColor;
  resetTime: string | null;
  accent?: boolean;
}

export default function UsageSection({ title, percent, color, resetTime, accent = false }: Props) {
  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <span style={styles.title}>{title}</span>
        {resetTime && (
          <span style={styles.reset}>Resets in {resetTime}</span>
        )}
      </div>
      <UsageBar percent={percent} color={color} accent={accent} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    padding: '10px 12px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '8px',
  },
  title: {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.07em',
    color: 'var(--text-tertiary)',
  },
  reset: {
    fontSize: '10px',
    color: 'var(--text-tertiary)',
    flexShrink: 0,
    fontVariantNumeric: 'tabular-nums',
  },
};
