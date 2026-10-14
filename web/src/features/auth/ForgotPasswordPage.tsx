import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/apiClient';
import { Button, Text } from '../../components';
import styles from './LoginPage.module.css';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İstek gönderilemedi.');
    }
  }

  if (sent) {
    return (
      <div className={styles.container}>
        <Text role="headline-sm" as="h1">E-postanı kontrol et</Text>
        <Text role="body-md">
          Bu e-posta ile kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderildi.
          Bağlantı 1 saat geçerlidir.
        </Text>
        <Text role="body-sm"><Link to="/giris">Giriş sayfasına dön</Link></Text>
      </div>
    );
  }

  return (
    <form className={styles.container} onSubmit={handleSubmit}>
      <Text role="headline-sm" as="h1">Şifremi Unuttum</Text>
      <Text role="body-md" tone="muted">
        Hesabına bağlı e-posta adresini gir, sana sıfırlama bağlantısı gönderelim.
      </Text>
      <input
        className={styles.input}
        type="email"
        placeholder="E-posta"
        aria-label="E-posta"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      {error && <Text role="body-sm" tone="error" className={styles.error}>{error}</Text>}
      <Button variant="primary" type="submit">Bağlantı Gönder</Button>
      <Text role="body-sm"><Link to="/giris">Giriş sayfasına dön</Link></Text>
    </form>
  );
}
