import { useState } from 'react';
import { Button, Card, Text, ThemeSelector } from '../../components';
import { PageContainer } from '../../layout/PageContainer';
import { useProfileData } from '../../data/useProfileData';
import { ProfileHeader, ProfileEditForm } from './components';
import styles from './ProfilePage.module.css';

const localeLabels: Record<string, string> = {
  tr: 'Türkçe',
  en: 'English',
};

export function ProfilePage() {
  const { profile, loading, error, saving, updateProfile } = useProfileData();
  const [isEditing, setEditing] = useState(false);

  return (
    <PageContainer>
      <div className={styles.headerRow}>
        <Text role="headline-lg" as="h1">
          Profilim
        </Text>
      </div>

      {loading && <Text role="body-md">Yükleniyor…</Text>}

      {!loading && error && !profile && (
        <Text role="body-md" tone="error">
          {error}
        </Text>
      )}

      {!loading && profile && (
        <Card padding="lg" elevation="1" className={styles.card}>
          {error ? (
            <Text role="body-sm" tone="error" className={styles.inlineError}>
              {error}
            </Text>
          ) : null}

          <ProfileHeader profile={profile} />

          {!isEditing ? (
            <div className={styles.details}>
              <div className={styles.detailRow}>
                <Text role="label-md" tone="muted">
                  Dil
                </Text>
                <Text role="body-md" tone="main">
                  {localeLabels[profile.locale] ?? profile.locale}
                </Text>
              </div>

              <div className={styles.detailRow}>
                <Text role="label-md" tone="muted">
                  Tema
                </Text>
                <div>
                  <ThemeSelector />
                </div>
              </div>

              <div className={styles.actions}>
                <Button variant="primary" iconStart="edit" onClick={() => setEditing(true)}>
                  Profili Düzenle
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.editSection}>
              <ProfileEditForm
                profile={profile}
                saving={saving}
                onCancel={() => setEditing(false)}
                onSubmit={async (input) => {
                  await updateProfile(input);
                  setEditing(false);
                }}
              />
            </div>
          )}
        </Card>
      )}
    </PageContainer>
  );
}
