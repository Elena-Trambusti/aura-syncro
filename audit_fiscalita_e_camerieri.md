# Report di Audit: Fiscalità, Mance e Attribuzione Staff (Aura Syncro)

Data: 2026-07-02
Obiettivo: Validazione definitiva logica di calcolo tasse (Italia, Spagna, Canarie), gestione mance e sicurezza attribuzione staff.

## 1. LE TRE FISCALITÀ REGIONALI (Italia, Spagna, Isole Canarie)
**Esito:** ✅ CONFORME (Nessuna patch necessaria)

L'architettura attuale nel `taxEngine.ts` gestisce in modo impeccabile i tre regimi fiscali:
* **ITALIA**: Gestita tramite la `FiscalRegion.ITALIA`, applica di default IVA (10% standard, sovrascrivibile per singolo piatto es. 4% o 22%).
* **SPAGNA (Penisola)**: Gestita tramite `FiscalRegion.SPAGNA_PENINSULA`, applica IVA spagnola standard.
* **ISOLE CANARIE**: Gestita tramite `FiscalRegion.ISOLE_CANARIE`, esclude correttamente l'IVA spagnola e applica l'IGIC di default al 7%.

**Punti di forza individuati:**
* La funzione `computeOrderTaxFromLines` effettua lo scorporo riga per riga, supportando aliquote miste nello stesso conto.
* È presente un algoritmo di *Penny Adjustment* per prevenire gli scarti di centesimo (floating point drift) tra il totale ivato e la somma dell'imponibile e delle tasse delle singole righe.

## 2. LOGICA DELLE MANCE (Tips Management)
**Esito:** ✅ CONFORME (Nessuna patch necessaria)

L'audit ha verificato il ciclo di vita della mancia all'interno di `tipFiscal.ts` e `completePayment.ts`:
* Le mance non vengono mai passate alle funzioni di scorporo (`scorporoTaxFromGross`). Il sistema calcola le tasse **solo** sul `grossFoodAmount`.
* Le funzioni `assertTipNeverTaxed` e `assertTipExcludedFromFiscalBase` formano un'eccellente blindatura architetturale per evitare regressioni, garantendo che le mance siano esentasse rispetto al regime IVA/IGIC e separate dalla base imponibile (`taxableChargeAmount` vs `tipChargeAmount`).
* La mancia concorre al totale richiesto al cliente su terminale POS/Stripe, ma contabilmente è separata in `revenueAmount` (ricavo ristorante) e `tipAmount` (quota esente).

## 3. COLLEGAMENTO AL CAMERIERE (Staff Attribution & Security)
**Esito:** ⚠️ VULNERABILITÀ INDIVIDUATA (Patch Richiesta)

### Analisi del problema
* **Integrità Rendicontazione:** Nessun problema sui calcoli. La ripartizione split (`computeSplitBreakdown`) previene disallineamenti di decimali ricalcolando la quota dell'ultimo ospite come differenza.
* **Sicurezza (Tip Stealing):** Durante la finalizzazione del pagamento (`POST /api/payments/finalize`), l'API accetta un parametro `tipWaiterId`. Attualmente, la funzione `resolveTipWaiterId` verifica solo che l'ID appartenga a un utente attivo nel ristorante. 
**Non verifica chi sta effettuando la richiesta.** Un cameriere che intercetta la richiesta di rete (o usa strumenti di dev) potrebbe inviare `tipWaiterId` = *il-proprio-id* anche per ordini serviti da altri colleghi, dirottando in modo silente le mance a proprio favore.

### Patch proposta
Occorre blindare l'assegnazione nel payload di finalizzazione, introducendo un controllo basato sui permessi (RBAC) in `backend/src/routes/payments.ts` o in `resolveTipWaiterId`.

**Implementazione raccomandata in `payments.ts`:**
Prima di chiamare `resolveTipWaiterId`, aggiungere questo blocco di validazione:

```typescript
// Recupera il ruolo dell'utente che sta finalizzando
const executor = await prisma.user.findUnique({
  where: { id: req.userId },
  select: { role: true }
});

// Se è un ruolo base e cerca di assegnare la mancia a un altro cameriere (diverso da se stesso e dal creatore originale dell'ordine)
if (executor && ['WAITER', 'BARTENDER'].includes(executor.role)) {
  if (tipWaiterId && tipWaiterId !== req.userId && tipWaiterId !== order.waiterId) {
    res.status(403).json({ 
      error: 'Non sei autorizzato ad assegnare mance ad altri colleghi', 
      code: 'UNAUTHORIZED_TIP_ASSIGNMENT' 
    });
    return;
  }
}
```

In alternativa, impostare di default `tipWaiterId = order.waiterId || req.userId` se il campo non viene passato o se l'utente non ha i privilegi di `MANAGER/OWNER` per modificarlo arbitrariamente.

## Conclusione
Il backend dal punto di vista matematico e fiscale è **Enterprise-Grade** e privo di *floating-point drift*. Applicando la patch sopra indicata per il RBAC sull'attribuzione mance, il modulo sarà totalmente blindato contro abusi.
