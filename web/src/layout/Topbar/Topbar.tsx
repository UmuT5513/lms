import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Icon, IconButton, SearchInput, Text, ThemeSelector } from '../../components';
import { useAuth } from '../../data/useAuth';
import type { UserProfile, UserRole } from '../../types';
import styles from './Topbar.module.css';

const ROLE_LABELS: Record<UserRole, string> = {
  STUDENT: 'Öğrenci',
  INSTRUCTOR: 'Eğitmen',
  ADMIN: 'Yönetici',
};

const ROLE_SWITCHER_LABELS: Record<UserRole, string> = {
  STUDENT: 'Öğrenci Paneli',
  INSTRUCTOR: 'Eğitmen Paneli',
  ADMIN: 'Yönetici Paneli',
};

interface TopbarProps {
  user: UserProfile | null;
  switchRole: (role: UserRole) => Promise<void>;
  onMenuToggle: () => void;
  isMenuOpen: boolean;
}

export function Topbar({ user, switchRole, onMenuToggle, isMenuOpen }: TopbarProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isRoleMenuOpen, setRoleMenuOpen] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    navigate('/giris', { replace: true });
  };

  useEffect(() => {
    if (!isRoleMenuOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target as Node)) {
        setRoleMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setRoleMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRoleMenuOpen]);

  const handleRoleSelect = async (role: UserRole) => {
    if (!user || role === user.role) {
      setRoleMenuOpen(false);
      return;
    }
    try {
      setSwitchError(null);
      await switchRole(role);
      setRoleMenuOpen(false);
      if (role !== 'ADMIN') {
        navigate('/');
      }
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : 'Rol değiştirilemedi.');
    }
  };

  const canSwitchRole = Boolean(user && user.roles.length > 1);

  return (
    <header className={styles.topbar}>
      <IconButton
        icon={isMenuOpen ? 'close' : 'menu'}
        label={isMenuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
        onClick={onMenuToggle}
        aria-expanded={isMenuOpen}
        className={styles.menuButton}
      />

      <div className={styles.search}>
        <SearchInput label="Ara" placeholder="Ders, içerik, hoca veya ödev ara..." />
      </div>

      <div className={styles.actions}>
        <div className={styles.theme}>
          <ThemeSelector compact />
        </div>
        <IconButton icon="notifications" label="Bildirimler" showDot />
        <IconButton icon="chat_bubble" label="Mesajlar" />
        <span className={styles.divider} aria-hidden="true" />

        {canSwitchRole && (
          <div className={styles.roleSwitcher} ref={roleMenuRef}>
            <button
              type="button"
              className={styles.roleSwitcherToggle}
              aria-haspopup="true"
              aria-expanded={isRoleMenuOpen}
              onClick={() => setRoleMenuOpen((open) => !open)}
            >
              <Icon name="swap_horiz" size="sm" />
              <Text role="label-md" tone="main">
                Panel Değiştir
              </Text>
            </button>

            {isRoleMenuOpen && (
              <div className={styles.roleSwitcherPanel} role="menu">
                {user?.roles.map((role) => (
                  <button
                    key={role}
                    type="button"
                    role="menuitemradio"
                    aria-checked={role === user.role}
                    className={[
                      styles.roleSwitcherOption,
                      role === user.role ? styles.roleSwitcherOptionActive : null,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => handleRoleSelect(role)}
                  >
                    <Text role="body-sm" tone={role === user.role ? 'primary' : 'main'}>
                      {ROLE_SWITCHER_LABELS[role]}
                    </Text>
                    {role === user.role && <Icon name="check" size="sm" />}
                  </button>
                ))}
                {switchError && (
                  <Text role="body-sm" tone="error" className={styles.roleSwitcherError}>
                    {switchError}
                  </Text>
                )}
              </div>
            )}
          </div>
        )}

        <Link to="/profil" className={styles.user} aria-label="Profilim">
          <Avatar name={user?.name ?? ''} src={user?.avatarUrl ?? undefined} />
          <span className={styles.userText}>
            <Text role="label-lg" tone="main">
              {user?.name ?? ''}
            </Text>
            <Text role="body-sm" tone="muted">
              {user ? ROLE_LABELS[user.role] : ''}
            </Text>
          </span>
        </Link>
        <IconButton icon="logout" label="Çıkış Yap" onClick={handleLogout} />
      </div>
    </header>
  );
}
