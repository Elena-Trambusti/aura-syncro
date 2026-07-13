# Aura Syncro — Frontend

SPA React per il gestionale ristoranti Aura Syncro: dashboard operativa, POS/tavoli, CRM, report fiscale, landing marketing e **PWA installabile** (inclusa TWA Android).

Documentazione progetto: [`../README.md`](../README.md)

---

## Stack

| Layer | Tecnologie |
|---|---|
| UI | React 19, TypeScript, Tailwind CSS 4 |
| Build | Vite, `vite-plugin-pwa` |
| Stato server | TanStack Query (cache tenant-scoped via `useTenantQueryKey`) |
| Routing | React Router |
| i18n | i18next — `src/i18n/locales/{it,en,es,fr,de}.json` + locale `es-cn` (Canarie) |
| Componenti | Radix UI, Recharts, Sonner (toast), Lucide |
| Real-time | Socket.IO client → invalidazione cache |
| Deploy | Vercel (`vercel.json` con proxy API/Socket.IO verso DigitalOcean) |

---

## Struttura principale

```
frontend/src/
├── pages/           # Dashboard, Tavoli, Ordini, Cassa, CRM, Report Fiscal…
├── components/
│   ├── layout/      # Sidebar, Header, DashboardLayout
│   └── ui/          # Primitivi Aura (dialog, tabs, KPI…)
├── contexts/        # AuthContext (tenant + regime fiscale)
├── hooks/           # useRole, useAccessTier, usePushNotifications…
├── lib/
│   ├── fiscalRegime.ts, fiscalPdf.ts, fiscalLabels.ts
│   ├── standaloneApp.ts, nativeSafeArea.ts, bootstrapStandalone.ts
│   ├── toast.ts, queryKeys.ts, accessTier.ts
│   └── taxEngine mirror (calcoli UI da regime ristorante)
├── i18n/
├── sw.ts            # Service worker (offline, cache)
└── e2e/             # Playwright
```

---

## Comandi

```bash
cd frontend
npm install
cp .env.example .env
npm run dev          # :5173 — genera manifest e screenshot PWA
npm run build        # build produzione
npm run preview      # anteprima build locale
npm run lint
```

### Test E2E (Playwright)

```bash
npm run test:e2e              # avvia automaticamente backend :3001 + frontend :5173
npm run test:e2e:ui             # interfaccia interattiva
npm run test:e2e:install        # installa Chromium (una tantum)
npm run test:e2e:report         # report HTML dopo run fallito
```

Dalla root monorepo: `npm run test:e2e` — vedi [`../docs/TESTING.md`](../docs/TESTING.md).

### Script PWA / brand

| Script | Ruolo |
|---|---|
| `generate-pwa-icons` | Icone launcher Android e PWA |
| `generate-pwa-screenshots` | Screenshot per manifest / Play Store |
| `prepare-brand-logo` | Logo display per UI |
| `optimize-images` | Ottimizzazione asset landing |

---

## Variabili d'ambiente

| Variabile | Descrizione |
|---|---|
| `VITE_API_URL` | URL backend (dev: `http://localhost:3001`) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Chiave pubblica Stripe |
| `BACKEND_URL` | Proxy Vercel → backend in produzione |

---

## PWA e app Android (TWA)

| Modulo | Ruolo |
|---|---|
| `public/manifest.json` | Web App Manifest (`standalone`, `start_url: /login?pwa=1`) |
| `public/.well-known/assetlinks.json` | Digital Asset Links (`com.aurasyncro.twa`) |
| `src/lib/standaloneApp.ts` | Rileva shell PWA/TWA/WebView |
| `src/lib/nativeSafeArea.ts` | Fallback `--safe-top` / `--safe-bottom` in WebView |
| `src/index.css` | `--safe-top-pad` / `--safe-bottom-pad` per sidebar, header, toast |
| `src/components/AuraSonner.tsx` | Toast globali con offset safe-area |
| `docs/android-premium-qa-matrix.md` | Checklist QA pre-release Android |

**Safe area:** su dispositivi con notch o status bar sovrapposta, sidebar, topbar, toast Sonner e profilo utente rispettano `calc(var(--safe-top) + 1rem)` — 1rem in browser, inset nativo + 1rem in app Android a tutto schermo.

---

## Regime fiscale (UI)

La terminologia fiscale (IVA/IGIC, P.IVA/NIF, formati data) deriva dal **regime del ristorante** (`taxRegion` in auth), non dalla sola lingua UI.

| Modulo | Percorso |
|---|---|
| Regime frontend | `src/lib/fiscalRegime.ts` |
| PDF fiscali | `src/lib/fiscalPdf.ts`, `fiscalLabels.ts` |
| Report | `src/pages/ReportFiscalPage.tsx` |
| i18n fiscale | chiavi `reportFiscal.byRegime.*` |

Mai hard-codare aliquote nei componenti: usare il motore centralizzato.

---

## Design system

- Sidebar scura (`premium-sidebar`), area lavoro `bg-slate-50` / navy
- Accento brand: ambra `amber-500` / `aura-gold`
- Logo: icona **Zap** (fulmine)
- Mobile POS: layout a tab, nessun overlap menu/carrello
- Contrasto elevato, niente glassmorphism che compromette la lettura

Regole complete: [`.cursorrules`](../.cursorrules) nella root del repo.

---

## Deploy

Il frontend è deployato su **Vercel**. Le richieste `/api/*` e Socket.IO sono inoltrate al backend DigitalOcean tramite `vercel.json`.

Build command: `npm run build` (dalla cartella `frontend`).
