import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { useTheme } from '../../lib/theme';
import type { ThemeChoice } from '../../lib/theme';
import { Icon } from '../Icon';
import styles from './ThemeSelector.module.css';

const OPTIONS: { value: ThemeChoice; label: string; icon: string }[] = [
  { value: 'system', label: 'Sistem', icon: 'contrast' },
  { value: 'light', label: 'Açık', icon: 'light_mode' },
  { value: 'dark', label: 'Koyu', icon: 'dark_mode' },
];

interface ThemeSelectorProps {
  /** Etiketleri gizleyip yalnızca ikon gösterir (Topbar). */
  compact?: boolean;
}

export function ThemeSelector({ compact = false }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + OPTIONS.length) % OPTIONS.length;
    setTheme(OPTIONS[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Tema" className={styles.group}>
      {OPTIONS.map((option, index) => {
        const checked = option.value === theme;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={compact ? option.label : undefined}
            title={option.label}
            tabIndex={checked ? 0 : -1}
            className={[styles.option, checked ? styles.active : null].filter(Boolean).join(' ')}
            onClick={() => setTheme(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <Icon name={option.icon} size="sm" />
            {!compact && <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
