import { useTranslation } from 'react-i18next';
import styles from './hardware-settings.module.css';

interface PaymentConfirmDialogProps {
  open: boolean;
  orderId: string;
  amountEuro?: number;
  onConfirm: (status: 'ok' | 'cancelled' | 'error') => void;
}

export function PaymentConfirmDialog({
  open,
  orderId,
  amountEuro,
  onConfirm,
}: PaymentConfirmDialogProps) {
  const { t } = useTranslation();

  if (!open) return null;

  const amountSuffix =
    amountEuro !== undefined
      ? t('checkout.paymentConfirmAmount', { amount: amountEuro.toFixed(2) })
      : '';

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.dialog}>
        <h2 className={styles.dialogTitle}>{t('checkout.paymentConfirmTitle')}</h2>
        <p className={styles.dialogText}>
          {t('checkout.paymentConfirmBody', { orderId, amount: amountSuffix })}
        </p>
        <div className={styles.dialogActions}>
          <button type="button" className={styles.btn} onClick={() => onConfirm('cancelled')}>
            {t('checkout.paymentConfirmCancelled')}
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => onConfirm('error')}>
            {t('checkout.paymentConfirmError')}
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => onConfirm('ok')}>
            {t('checkout.paymentConfirmPaid')}
          </button>
        </div>
      </div>
    </div>
  );
}
