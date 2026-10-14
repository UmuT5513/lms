import { useNavigate } from 'react-router-dom';
import { Button } from '../../components';
import { formatPrice } from '../../lib/price';

interface PurchaseButtonProps {
  courseId: string;
  priceKurus: number;
}

/** Ücretli kurs için "Satın Al" düğmesi; ödeme sayfasına götürür. */
export function PurchaseButton({ courseId, priceKurus }: PurchaseButtonProps) {
  const navigate = useNavigate();
  return (
    <Button variant="primary" iconStart="shopping_cart" onClick={() => navigate(`/odeme/${courseId}`)}>
      {`Satın Al (${formatPrice(priceKurus)})`}
    </Button>
  );
}
