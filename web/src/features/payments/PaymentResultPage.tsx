import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, Text } from '../../components';
import { PageContainer } from '../../layout/PageContainer';
import { apiFetch } from '../../lib/apiClient';
import { formatPrice } from '../../lib/price';
import styles from './PaymentPages.module.css';

interface OrderStatus {
  merchantOid: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  courseId: string;
  courseTitle: string;
  amountKurus: number;
  failedReasonMsg: string | null;
}

const POLL_MS = 3000;
const MAX_POLLS = 20;

/**
 * PayTR dönüş sayfası. Buraya gelinmesi ödemenin onaylandığı anlamına gelmez;
 * kesin sonuç sunucuya bildirimle ulaşır, bu yüzden sipariş durumu sorgulanır.
 */
export function PaymentResultPage() {
  const [params] = useSearchParams();
  const oid = params.get('oid');
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (!oid) return;
    let cancelled = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const { order: next } = await apiFetch<{ order: OrderStatus }>(`/api/v1/payments/${oid}`);
        if (cancelled) return;
        setOrder(next);
        polls += 1;
        if (next.status === 'PENDING') {
          if (polls < MAX_POLLS) timer = setTimeout(poll, POLL_MS);
          else setGaveUp(true);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Sipariş durumu alınamadı.');
      }
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [oid]);

  let body;
  if (!oid) {
    body = <Text role="body-md" tone="error">Sipariş numarası eksik.</Text>;
  } else if (error) {
    body = <Text role="body-md" tone="error">{error}</Text>;
  } else if (!order || (order.status === 'PENDING' && !gaveUp)) {
    body = <Text role="body-md" tone="muted">Ödeme sonucu bekleniyor…</Text>;
  } else if (order.status === 'PAID') {
    body = (
      <>
        <Text role="title-md" tone="success" as="h2">Ödeme başarılı</Text>
        <Text role="body-md" as="p" className={styles.notice}>
          {order.courseTitle} kursuna kaydınız açıldı ({formatPrice(order.amountKurus)}).
        </Text>
        <Link to={`/kurslarim/${order.courseId}`}>Kursa git</Link>
      </>
    );
  } else if (order.status === 'FAILED') {
    body = (
      <>
        <Text role="title-md" tone="error" as="h2">Ödeme tamamlanamadı</Text>
        {order.failedReasonMsg && (
          <Text role="body-md" as="p" className={styles.notice}>{order.failedReasonMsg}</Text>
        )}
        <Link to={`/odeme/${order.courseId}`}>Tekrar dene</Link>
      </>
    );
  } else {
    body = (
      <>
        <Text role="body-md" as="p" className={styles.notice}>
          Ödeme sonucu henüz bize ulaşmadı. Birkaç dakika içinde kurslarım sayfasından kontrol edebilirsiniz.
        </Text>
        <Link to="/kurslarim">Kurslarım</Link>
      </>
    );
  }

  return (
    <PageContainer>
      <div className={styles.container}>
        <Text role="headline-sm" as="h1">Ödeme Sonucu</Text>
        <Card padding="lg" elevation="1" className={styles.result}>
          {body}
        </Card>
      </div>
    </PageContainer>
  );
}
