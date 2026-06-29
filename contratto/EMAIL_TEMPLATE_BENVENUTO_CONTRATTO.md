# Template email — Benvenuto + Contratto Aura Syncro

Usa questa email **subito dopo il pagamento Stripe** (o insieme al link DocuSign/YouSign per la firma).

---

## Variabili da sostituire

| Placeholder | Esempio |
|-------------|---------|
| `{{NOME_CLIENTE}}` | Mario Rossi |
| `{{RAGIONE_SOCIALE}}` | Trattoria da Mario S.r.l. |
| `{{PIANO}}` | Premium |
| `{{SETUP_EURO}}` | 500 |
| `{{CANONE_EURO}}` | 199 |
| `{{LINK_FIRMA}}` | https://yousign.com/... o allegato PDF |
| `{{SLUG}}` | trattoria-da-mario |

---

## Oggetto email (scegli uno)

```
Aura Syncro — Benvenuto! Firma il contratto e avvia l'onboarding {{RAGIONE_SOCIALE}}
```

```
[Azione richiesta] Contratto Aura Syncro {{PIANO}} — {{RAGIONE_SOCIALE}}
```

---

## Corpo email (versione completa)

```
Gentile {{NOME_CLIENTE}},

grazie per aver scelto Aura Syncro {{PIANO}} per {{RAGIONE_SOCIALE}}.

Il pagamento è stato registrato correttamente:
  • Setup iniziale (una tantum): € {{SETUP_EURO}},00 + IVA
  • Canone mensile: € {{CANONE_EURO}},00 + IVA (addebito automatico Stripe)

────────────────────────────────────────
AZIONE 1 — FIRMA CONTRATTO (obbligatoria)
────────────────────────────────────────

Per attivare formalmente il servizio B2B, ti chiediamo di firmare il Contratto di 
Licenza d'Uso e Fornitura Servizi SaaS:

  → {{LINK_FIRMA}}

In allegato trovi anche:
  • Riepilogo esecutivo (2 pagine)
  • Contratto integrale v2.0

Il contratto regola licenza d'uso, pagamenti, privacy (GDPR), limitazioni di 
responsabilità e foro competente (Livorno). È un accordo tra professionisti (B2B).

────────────────────────────────────────
AZIONE 2 — ONBOARDING (entro 7 giorni)
────────────────────────────────────────

1. Compila il modulo configurazione (menu, allergeni, dati locale):
   https://tally.so/r/WOQp1P

2. Prenota la call di setup con il team (30 min):
   https://calendly.com/aurasyncro/30min

3. Rispondi a questa email inviando:
   • Planimetria tavoli (PDF o foto)
   • Export menu (Excel, PDF o link)
   • Elenco utenti staff (nome, email, ruolo: cameriere/cucina/cassa)
   • P.IVA e regime fiscale (Italia / Spagna penisola / Canarie)

────────────────────────────────────────
ACCESSO ALLA PIATTAFORMA
────────────────────────────────────────

  Login: https://aurasyncro.com/login
  Email registrata: [email del cliente]

Dopo il login vedrai la pagina Onboarding con lo stato di avanzamento.
La dashboard operativa completa sarà sbloccata al termine del setup concierge 
e del collaudo (di solito entro 5–10 giorni lavorativi).

────────────────────────────────────────
COSA NON È INCLUSO (per chiarezza)
────────────────────────────────────────

• Hardware (tablet, stampanti, registratore di cassa)
• Connessione internet del locale
• Scontrino fiscale legale dal vostro POS — Aura Syncro è il gestionale, non 
  sostituisce il registratore telematico dove richiesto dalla legge

────────────────────────────────────────

Per qualsiasi domanda: elenatrambusti2024@gmail.com

A presto,
Elena Trambusti
Aura Syncro — Gestionale Premium per Ristoranti
https://aurasyncro.com

---
Termini: https://aurasyncro.com/termini
Privacy: https://aurasyncro.com/privacy
```

---

## Corpo email (versione breve)

```
Ciao {{NOME_CLIENTE}},

benvenuto in Aura Syncro {{PIANO}}! Pagamento ricevuto ✓

Prossimi passi:
1. Firma il contratto → {{LINK_FIRMA}}
2. Modulo setup → https://tally.so/r/WOQp1P
3. Prenota call → https://calendly.com/aurasyncro/30min
4. Invia planimetria tavoli + menu a questa email

Login: https://aurasyncro.com/login

Grazie,
Elena — Aura Syncro
elenatrambusti2024@gmail.com
```

---

## Allegati da inviare

| File | Uso |
|------|-----|
| `contratto/CONTRATTO_RIEPILOGO_ESECUTIVO.pdf` | Sintesi 2 pagine (genera da HTML) |
| `CONTRATTO_ABBONAMENTO_AURA_SYNCRO_PREMIUM.pdf` | Contratto integrale firmabile |

### Come generare i PDF

1. Apri `contratto/CONTRATTO_RIEPILOGO_ESECUTIVO.html` in Chrome  
2. `Ctrl+P` → Destinazione: **Salva come PDF**  
3. Per il contratto integrale: incolla il `.md` in Google Docs / Word → Esporta PDF

---

## Sequenza consigliata

```
Giorno 0  → Pagamento Stripe + email benvenuto + link firma
Giorno 0–2 → Cliente firma + compila Tally + prenota Calendly
Giorno 2–5 → Tu configuri menu/tavoli/fiscale
Giorno 5–7 → Call + UAT + POST /api/admin/setup-complete
Giorno 7+  → Go-live primo servizio
```

---

## Checklist interna (prima di inviare)

- [ ] `{{LINK_FIRMA}}` attivo (DocuSign / YouSign / PDF firmato)
- [ ] Piano e importi corretti (Starter vs Premium)
- [ ] Allegati PDF allegati
- [ ] Cliente visibile in `GET /api/admin/registrations?today=true`
- [ ] Copia email archiviata nella cartella cliente
