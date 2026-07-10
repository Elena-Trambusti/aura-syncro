# Android Premium QA Matrix

## Scope
Quality gates for the Aura Syncro Android premium experience across UX, performance, realtime reliability, and PWA lifecycle.

## Device classes

| Class | Example profile | Min Android | Focus |
|---|---|---:|---|
| Entry | 4GB RAM / low-mid CPU | 10 | Stability, no freezes, acceptable motion |
| Mid | 6-8GB RAM / Snapdragon 7xx | 11 | Smooth service operations, no jank spikes |
| High | 8GB+ / flagship | 12+ | Premium polish, high visual fidelity |

## Core scenarios (must pass)

1. Open app from icon and resume from background (3 times in a row)
2. Navigate Dashboard -> Tavoli -> Ordini -> Cassa -> Prenotazioni
3. High-frequency table state changes during active service
4. Open/close bottom sheets and dialogs with one-hand usage
5. Offline -> queue actions -> reconnect sync recovery
6. PWA update available -> defer -> apply manually at safe moment

## Performance budgets

| Metric | Budget | Release gate |
|---|---:|---|
| Initial interactive (authenticated shell) | <= 2.5s on mid device | Block if exceeded in 2+ routes |
| Interaction latency (tap to feedback) | <= 120ms p95 | Block if exceeded in service-critical actions |
| Long tasks | <= 2 occurrences/min > 120ms | Block if frequent on Tavoli/Ordini |
| Scrolling fluidity | target 55-60 FPS | Block if visible frame drops in critical lists |

## Realtime quality gates

- No duplicate toasts for single action
- No visible full-page reload during normal operation
- Socket reconnect must recover data within 3s when network returns
- Invalidation bursts must not cause UI thrash

## PWA quality gates

- Install banner appears only on mobile browser, not desktop
- Update prompt is manual-confirm only (no forced reload)
- Update prompt cooldown respected (no repeated spam)
- Service worker update and cache transition tested after fresh deploy

## Visual luxury gates

- Touch targets >= 44px in mobile actionable controls
- Focus ring visible and consistent for keyboard/accessibility
- Motion pack consistent timing/easing in topbar, sidebar, cards, sheets
- No overlapping UI in notched and gesture-nav devices

## Release decision checklist

- [ ] Entry/mid/high device smoke test completed
- [ ] Performance budgets verified on Tavoli + Ordini
- [ ] Realtime scenarios validated with concurrent updates
- [ ] Offline/reconnect queue flow verified
- [ ] PWA install/update lifecycle validated after deploy
- [ ] Visual review approved against premium baseline screenshots
