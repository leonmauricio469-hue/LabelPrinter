# Feature: ajustes-fase1-importar-alarma

## Objective
Cerrar los dos cableados baratos de Ajustes: `Importar Perfil` y `Test de alarma de error`. Sin papel, sin backend nuevo.

## Problem
- `settings-seccion3.tsx:194` — `Importar Perfil` en `disabled`. El PUT parcial con merge ya existe (`api/settings/route.ts:10`).
- `settings-seccion2.tsx:184` — `Test Sonido` solo prueba `beepOk()`; `sonidoError`/alarma existe (`sonido.ts`, schema) sin botón de prueba.

## Why
Fase 1 del plan aceptado por el operador: valor inmediato, riesgo papel nulo.

## Scope
- Importar: file-picker (.json) → parse con mensaje de error honesto → `PUT /api/settings` → refresca estado + `lastSyncOk`. Sin cambiar contrato (objeto completo tras merge, claves intactas).
- Alarma: botón `Probar alarma` junto a `Test Sonido` que emite `sonidoError()` real, con mismo patrón de error honesto.
- Tests/docs junto al código. Sin `TODO` nuevos.

## Constraints
- `"use client"`, claves intactas, `server-only` fuera de cliente, reusá `ui.ts`, sin `^PQ`/`^MF`/`^CI`.
- No tocar fuera de las superficies.

## Tasks
- [x] **T1** Importar Perfil cableado — file-picker + PUT + refresh + errores honestos.
  - Route: delegated direct (writer trigger: 2 files no triviales en el slice).
  - Acceptance: elegir JSON válido actualiza settings y marca sync; JSON inválido muestra error sin romper estado.
  - Checks: typecheck + prueba manual sin papel.
- [x] **T2** Probar alarma de error — botón junto a Test Sonido con `sonidoError()` real.
  - Route: delegated direct (mismo writer).
  - Acceptance: click emite alarma; sin auricular no rompe nada (error honesto).
  - Checks: typecheck + prueba manual.
- [ ] **T3** Cierre — commits por tarea, assess, verificación enfocada.
  - Route: delegated direct (writer self-verification + parent spot check).
  - Acceptance: commits convencionales con IDs abajo; sin TODO nuevos.
  - Checks: verification del writer + `git status` + assess.

## Authorized scope
- Editar: `label-printer-web/src/components/settings-seccion2.tsx`, `label-printer-web/src/components/settings-seccion3.tsx`
- No tocar fuera de lo anterior.

## Delivery strategy
- Strategy: ask-on-risk (default). Forecast: <120 authored lines. Running count: 0. Slice: single-pr previsto.

## Progress
- 2026-10-10: doc creado, 3 tareas. Branch `feat/ajustes-fase1` desde `feat/ajustes-rebuild-template`.
- 2026-10-10: T2 hecho (`2d0796d`): `Probar alarma` junto a `Test Sonido` emite `beepError()` real de `sonido.ts` (lib sin tocar) con mensaje honesto. T1 hecho (`f48ebc4`): `Importar Perfil` habilitado con file-picker `.json`, parse try/catch con error honesto y estado intacto, `PUT /api/settings`, refresh de `label` + `onImportado?` opcional para que la página marque `lastSyncOk` (cableado de la página pendiente, fuera de superficies). Mirror Engram PENDIENTE (falla project resolution — sin reintento por orden).

## Verification evidence
- `npm --prefix label-printer-web run typecheck`: verde (`tsc --noEmit` sin errores), tras T1 final.
- `git status --short`: solo `M settings-seccion3.tsx` antes del commit T1 (+ doc untracked); limpio tras T1+doc salvo lo que agregue el cierre.
- `git diff --stat`: T1 = 1 file changed, 97 insertions, 8 deletions (`settings-seccion3.tsx`).
- Sin `TODO` nuevos, sin `server-only` en cliente, sin ZPL emitido nuevo (los 2 `^CI` de seccion2 son texto honesto preexistente). Prueba manual sin papel pendiente (parent spot check).

## Commits
- T2: `2d0796d` feat(settings): cablea Probar alarma con beepError real
- T1: `f48ebc4` feat(settings): cablea Importar Perfil con PUT y refresh honesto

## Verification evidence
- (pendiente)

## Next step
- Lanzar writer acotado con T1+T2.
