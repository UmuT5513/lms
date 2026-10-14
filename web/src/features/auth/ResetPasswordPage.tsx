import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../lib/apiClient';
import { Button, Text } from '../../components';
import styles from './LoginPage.module.css';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    try {
      await apiFetch('/api/v1/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Şifre sıfırlanamadı.');
    }
  }

  if (!token) {
    return (
      <div className={styles.container}>
        <Text role="headline-sm" as="h1">Geçersiz bağlantı</Text>
        <Text role="body-md">Sıfırlama bağlantısı eksik. Yeni bir bağlantı isteyin.</Text>
        <Text role="body-sm"><Link to="/sifremi-unuttum">Yeni bağlantı iste</Link></Text>
      </div>
    );
  }

  if (done) {
    return (
      <div className={styles.container}>
        <Text role="headline-sm" as="h1">Şifren güncellendi</Text>
        <Text role="body-md">Yeni şifrenle giriş yapabilirsin.</Text>
        <Text role="body-sm"><Link to="/giris">Giriş Yap</Link></Text>
      </div>
    );
  }

  return (
    <form className={styles.container} onSubmit={handleSubmit}>
      <Text role="headline-sm" as="h1">Yeni Şifre Belirle</Text>
      <input
        className={styles.input}
        type="password"
        placeholder="Yeni şifre (en az 8 karakter)"
        aria-label="Yeni şifre"
        autoComplete="new-password"
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <input
        className={styles.input}
        type="password"
        placeholder="Yeni şifre (tekrar)"
        aria-label="Yeni şifre (tekrar)"
        autoComplete="new-password"
        minLength={8}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
      />
      {error && <Text role="body-sm" tone="error" className={styles.error}>{error}</Text>}
      <Button variant="primary" type="submit">Şifreyi Güncelle</Button>
    </form>
  );
}
