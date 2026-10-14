import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, Text } from '../../components';
import { PageContainer } from '../../layout/PageContainer';
import { apiFetch } from '../../lib/apiClient';
import { formatPrice } from '../../lib/price';
import type { CourseDetail } from '../../types';
import styles from './PaymentPages.module.css';

interface CheckoutResponse {
  merchantOid: string;
  iframeToken: string;
}

/** 1. ADIM: sipariş oluşturulur, PayTR ödeme formu iframe içinde açılır. */
export function CheckoutPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [iframeToken, setIframeToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    (async () => {
      try {
        const { course: detail } = await apiFetch<{ course: CourseDetail }>(`/api/v1/courses/${courseId}`);
        if (cancelled) return;
        setCourse(detail);
        const result = await apiFetch<CheckoutResponse>(`/api/v1/courses/${courseId}/checkout`, {
          method: 'POST',
        });
        if (!cancelled) setIframeToken(result.iframeToken);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Ödeme başlatılamadı.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  return (
    <PageContainer>
      <div className={styles.container}>
        <div className={styles.summary}>
          <div>
            <Text role="headline-sm" as="h1">Ödeme</Text>
            {course && (
              <Text role="body-md" tone="muted">
                {course.title}
              </Text>
            )}
          </div>
          {course && (
            <Text role="title-md" tone="main">
              {formatPrice(course.priceKurus)}
            </Text>
          )}
        </div>

        {error && (
          <Card padding="lg" elevation="1" className={styles.result}>
            <Text role="body-md" tone="error" as="p" className={styles.notice}>
              {error}
            </Text>
            <Link to={courseId ? `/kurslarim/${courseId}` : '/kurslarim'}>Kursa dön</Link>
          </Card>
        )}

        {!error && !iframeToken && <Text role="body-md" tone="muted">Ödeme formu hazırlanıyor…</Text>}

        {iframeToken && (
          <>
            <iframe
              className={styles.frame}
              src={`https://www.paytr.com/odeme/guvenli/${iframeToken}`}
              title="PayTR güvenli ödeme formu"
            />
            <Text role="body-sm" tone="muted">
              Kart bilgileriniz doğrudan PayTR'a iletilir; sistemimizde saklanmaz.
            </Text>
          </>
        )}
      </div>
    </PageContainer>
  );
}
