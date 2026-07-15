import type { ReactNode } from 'react';
import { AuraHardwareProvider } from '@/components/hardware/AuraHardwareProvider';
import type { PaymentResult } from '@/lib/hardware/aura-bridge';
import { completePendingNativeCheckout } from '@/lib/hardware/native-pos-checkout';
import { toast } from '@/lib/toast';
import i18n from '@/i18n';

async function handlePaymentConfirmed(result: PaymentResult) {
  if (result.status !== 'ok') return;

  try {
    await completePendingNativeCheckout(result);
    toast.success(
      i18n.t('checkout.paymentSuccess', { defaultValue: 'Pagamento registrato' }),
    );
  } catch {
    toast.error(
      i18n.t('checkout.paymentError', { defaultValue: 'Errore registrazione pagamento' }),
    );
  }
}

export function AuraHardwareRoot({ children }: { children: ReactNode }) {
  return (
    <AuraHardwareProvider onPaymentConfirmed={handlePaymentConfirmed}>
      {children}
    </AuraHardwareProvider>
  );
}
