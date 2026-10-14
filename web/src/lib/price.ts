const formatter = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });

/** Kuruş cinsinden tutarı "₺1.234,50" biçiminde gösterir. */
export function formatPrice(kurus: number): string {
  return formatter.format(kurus / 100);
}
