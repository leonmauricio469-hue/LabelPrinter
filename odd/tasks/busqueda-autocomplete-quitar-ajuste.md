# Feature: busqueda-autocomplete-quitar-ajuste

## Objective
Agregar Autocomplete + Predictive Search a la barra de búsqueda de producto y quitar el link Ajustes duplicado de la barra de ventanas de Imprimir.

## Problem
- La búsqueda hoy solo resuelve al Enter/submit o scan (`centro-impresion.tsx:858-882`, `resolve:492-549`). No hay dropdown vivo, debounce, teclado ni ARIA.
- La barra de ventanas muestra Imprimir/Editor/Ajustes (`centro-impresion.tsx:711-721`) cuando `/settings` ya es reachable vía `AppNav` (`app-nav.tsx:28-32`), `Configurar` (`app-shell.tsx:91-96`) y drawer. Duplicado.

## Why
Operador de mostrador con escáner en mano necesita sugerencias mientras tipea sin perder foco del scanner, y una barra sin duplicados.

## Scope
- Autocomplete combobox sobre `/api/products?q=` (partial top-60 con fold, sin cambiar endpoint).
- Quitar solo `Link /settings` en centro-impresion, mantener `/settings` reachable.
- Tests + docs junto al comportamiento.

## Constraints
- `label-printer-web/AGENTS.md`: leer guía relevante en `node_modules/next/dist/docs/` antes de escribir código (Link, App Router client/server). No commitear borrado del bloque.
- Ambos archivos son `"use client"`; rutas internas con `Link href` string; `usePathname` de `next/navigation` para activo.
- `ScannerInput` ignora teclas con foco en INPUT (`scanner-input.tsx:59-64`): no robar foco, no doble `resolve`.
- A11y: `role=combobox/listbox/option`, `aria-expanded/activedescendant`, `aria-live` para conteo, foco visible, táctil ≥44px, `autoComplete="off"`, `enterKeyHint="search"`, dropdown con max-height + scroll sin tapar IMPRIMIR.
- NO tocar: `route.ts/lookup/repo`, `app-nav.tsx`, `app-shell.tsx`, `settings/page.tsx`.

## Tasks
- [x] **T1** Autocomplete + Predictive Search en barra producto — combobox con debounce 150-250ms + AbortController, teclado ↑↓/Enter/Esc, highlight `<mark>`, reutiliza `lookupProducts`/`/api/products?q=` (route: direccional inline o delegada).
  - Route: delegated direct (writer trigger: 2+ non-trivial files; mapping ya hecho por explorer).
  - Acceptance: tipear 3+ chars muestra sugerencias top-60 con fold; Enter selecciona exacto; Esc cierra sin perder foco; scan USB sigue haciendo submit.
  - Checks: typecheck + tests relacionados + prueba manual teclado/scanner.
- [x] **T2** Quitar Ajustes de barra ventanas — borra solo `Link /settings` en `centro-impresion.tsx:718-720`, deja Imprimir/Editor, actualiza comentario `:57-58`, verifica `/settings` sigue vía tabs/Configurar/drawer/URL.
  - Route: delegated direct (mismo writer, mismo branch).
  - Acceptance: nav de Imprimir sin Ajustes; `/settings` abre directo y desde AppNav/Configurar.
  - Checks: typecheck + grep sin `/settings` en centro + navegación manual.
- [ ] **T3** Cierre — tests/docs junto al código, work-unit commits por tarea, assess de riesgo y verificación enfocada.
  - Route: delegated direct (writer self-verification + parent spot check).
  - Acceptance: commits convencionales en feature branch con IDs registrados abajo; sin `TODO` nuevos.
  - Checks: comandos de ## Verification del writer + `git status --short`.

## Authorized scope
- Editar: `label-printer-web/src/components/centro-impresion.tsx`, `label-printer-web/src/components/use-print.ts`
- Crear: `label-printer-web/src/components/product-search.tsx` (opcional para no engordar centro), tests colocalizados bajo `label-printer-web/src/components/__tests__/` o `*.test.tsx` junto al componente
- No tocar fuera de lo anterior.

## Delivery strategy
- Strategy: ask-on-risk (default). Forecast: <400 authored changed lines (combobox ~120-180 + T2 ~10 + tests ~100). Running count: 0. Slice: single-pr previsto.

## Progress
- 2026-10-09: doc creado, 3 tareas. Explorer handoff confirma sin autocomplete (0 matches combobox) y botón Configurar como duplicado real (`app-shell.tsx:91-96`).
- 2026-10-09: T1+T2 implementados en `feat/busqueda-autocomplete-quitar-ajuste`.
  - T1: nuevo `label-printer-web/src/components/product-search.tsx` (combobox ARIA, debounce 200ms, AbortController como guarda de staleness sin cambiar `lookupProducts`, teclado ↑↓/Enter/Esc, `<mark>`, `aria-live`, `autoComplete="off"`, `enterKeyHint="search"`, dropdown `max-h-60` con scroll); `centro-impresion.tsx` integra `ProductSearch` en el form existente + `elegirProducto` compartido (sugerencia y tarjetas, sin re-`resolve`). Commit `092934c`.
  - T2: borrado solo el `Link href="/settings"` de la nav de ventanas + comentario `:57-58` actualizado; `/settings` sigue en `app-nav.tsx:31` y `app-shell.tsx:92`. Commit `e7c9c64`.
  - Excepción TDD: `package.json` sin script `test` y sin config vitest/jest/playwright runnable (playwright solo aparece como dependencia transitiva en `package-lock.json`); no se creó `product-search.test.tsx`.

## Verification evidence
- `npm --prefix label-printer-web run typecheck`: exit 0, sin errores (post T1+T2).
- `grep /settings centro-impresion.tsx`: sin `Link href="/settings"`; solo mención en comentario, `GET /api/settings` y tipo `AjustesOperativos`.
- `git status --short` / `git diff --stat`: ver committing abajo; sin `TODO` nuevos.
- Pendiente manual (parent/operador): teclado (↑↓/Enter/Esc), scan USB con foco en input, y abrir `/settings` directo + desde AppNav/Configurar.

## Next step
- Lanzar un writer acotado en feature branch `feat/busqueda-autocomplete-quitar-ajuste` con T1+T2, luego verificación y commits por tarea.
