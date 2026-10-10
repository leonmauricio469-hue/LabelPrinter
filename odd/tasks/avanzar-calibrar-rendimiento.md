# Feature: avanzar-calibrar-rendimiento

## Objective
Cablear Avanzar 1 Etiqueta + Calibrar Gap con comando ZPL de fuente oficial Zebra (pendiente de prueba física del operador) y reducir el costo 2.4s/etiqueta + tope 6.

## Problem
- UI `centro-impresion.tsx:947-969` renderiza Avanzar/Calibrar en `disabled` por falta de comando verificado. Explorer confirma 0 hits de `~TA ~JC ^MF ~JG ^JUS ^PF ~PS ^PQ` en repo + `02-Tecnico` + `05-Referencias`.
- Perf: 1 `powershell.exe` por fila de lote (`lotes/[id]/control/route.ts:73-109` secuencial), 2 spawns en `GET /api/printers` + 1 en status por refresh post-print, y tope 6 por argv base64 (`schemas.ts:30-50`, `quantity-stepper.tsx:7-22`, `usb.transport.ts:40`, `send-raw.ps1:20-21`).

## Why
Operador pidió explícitamente "Cablear con prueba física": prefiere botones cableados con comando oficial aunque queden en modo prueba física antes que dejarlos apagados.

## Scope
- Research solo-docs oficiales Zebra GX420 (primarias), sin inventar.
- Nuevas rutas delgadas `POST /api/printer/feed|calibrate` sobre `transport.send()` existente, sin auditoría de venta, sin tocar foco scanner.
- Perf: payload por archivo temp/stdin (argv solo ruta corta) para levantar tope 6, acumular filas de lote en 1 send, unificar spawns de status/printers. No usar `^PQ` (0 hits, no verificado).
- Tests/docs junto al código. Sin `TODO` nuevos.

## Constraints
- `label-printer-web/AGENTS.md` + guía `node_modules/next/dist/docs/` antes de codificar. No commitear borrado del bloque.
- `"use client"` en centro/product-search; rutas con `Link`, `usePathname` de `next/navigation`. No mover hooks al layout server.
- No robar foco, no doble `resolve` (scanner ignora foco en INPUT). No tocar montaje excluyente de modos.
- Comandos `~` fuera de `^XA` como `aplicarOscuridad()` (`labels/route.ts:68-84`), pero ese `~SD` sigue pendiente físico: mismo patrón, misma honestidad.
- NO tocar: `scanner-input.tsx`, firmas de `route.ts` existentes salvo adición delgada, ni `app-nav/app-shell/settings/page`.

## Tasks
- [x] **T1** Research oficial Zebra GX420 feed + gap-calibrate — fuente primaria, comando exacto, bytes, fuera/dentro de `^XA`, efecto papel, riesgo. Solo lectura.
  - Route: delegated direct (research worker read-only).
  - Acceptance: cita URL + comando + evidencia de manual, o ausencia explícita.
  - Checks: URLs primarias + grep 0-hits previo registrado.
  - Outcome (observado 2026-10-09): `~PH` suelto para avanzar (o `^XA^PH^XZ`), `~JC` suelto + `^XA^JUS^XZ` para calibrar, no `^MF`. Fuentes `docs.zebra.com` + ZPL II Vol.2 + GX420t/GX430t UG. Riesgo: feed mínimo, calibrar medio-alto (1-4 etiquetas).
- [x] **T2** Cablear Avanzar/Calibrar — rutas delgadas + UI habilitada con aviso "pendiente prueba física" + confirmación, errores honestos, sin auditoría venta.
  - Route: delegated direct (writer trigger: 2+ files).
  - Acceptance: click Avanzar avanza 1 sin imprimir venta; Calibrar corre calibración; fallo muestra error real; scan/foco intactos.
  - Checks: typecheck + prueba manual física pendiente operador.
  - Outcome (observado 2026-10-09): `POST /api/printer/mantenimiento` única con `{accion:"feed"|"calibrar"}` → `~PH` suelto / `~JC` + `^XA^JUS^XZ` por `transport.send()`; sin auditoría (igual que test-print). UI habilitada con aviso + confirmación en 2 pasos para Calibrar, errores verbatim, sin `autoFocus`/`.focus()`, `ScannerInput` y montaje excluyente intactos. `typecheck` verde. Prueba física en papel PENDIENTE (operador).
- [x] **T3** Rendimiento + tope 6 — temp-file/stdin, acumular lote en 1 send, unificar status/printers, subir tope con evidencia `CreateProcessW`.
  - Route: delegated direct (mismo writer).
  - Acceptance: lote 20 filas pasa de ~20 spawns a ~1 + auditoría por fila intacta; qty>6 sin 34072; status sin spawn extra por print.
  - Checks: typecheck + medición spawns/tiempos reportada.
  - Outcome (observado 2026-10-09): `sendZplUsb()` escribe ZPL a archivo temporal y `argv` lleva solo `-FilePath` (~200 caracteres); `send-raw.ps1` acepta `-FilePath` (compat con `-Base64`). `MAX_QTY_POR_TRABAJO` 6→50 con evidencia `CreateProcessW 32767` / `qty7=34072` en el comentario; `quantity-stepper` hereda sin tocarlo. Lote acumula bloques `^XA...^XZ` en 1 `transport.send`, auditoría por fila con `jobId` propio + 1 `saveLote`; pausa/cancelación en borde de lote (documentado). `GET /api/printers`: 2 spawns→1 (`Name,JobCount` juntos) + cache 3 s (mismo TTL que `queue.status.ts`); `queue.status.ts` verificado sin cambio (ya 1 spawn + TTL 3 s, sin `force` añadido). `typecheck` verde. Sin `^PQ`. Medición de tiempos en hardware PENDIENTE (sin impresora en este entorno).
- [x] **T4** Cierre — commits por tarea, assess, verificación enfocada.
  - Route: delegated direct (writer self-verification + parent spot check + review nativa).
  - Acceptance: commits convencionales con IDs abajo, sin TODO nuevos.
  - Checks: verification del writer + `git status` + assess + spot check + review aprobada y quemada.
  - Outcome (observado 2026-10-09): writer `typecheck` verde + status limpio; parent spot check `typecheck` exit 0; assess `medium / slice_budget_reached` (1059 líneas) → review `reliability` aprobada (`acknowledged`, authority `burned`, lineage `review-dc5fda91669c13c7`); 2 WARNINGs informativos como follow-ups (pausa-en-resolve en lote, sin asserts automatizados), sin corrección ofrecida.

## Authorized scope (a refinar por researcher antes del writer)
- Editar: `label-printer-web/src/components/centro-impresion.tsx`, `label-printer-web/src/lib/printing/usb.transport.ts`, `label-printer-web/scripts/send-raw.ps1`, `label-printer-web/src/lib/validation/schemas.ts`, `label-printer-web/src/app/api/lotes/[id]/control/route.ts`, `label-printer-web/src/app/api/printers/route.ts`, `label-printer-web/src/lib/printing/queue.status.ts`
- Crear: `label-printer-web/src/app/api/printer/feed/route.ts`, `label-printer-web/src/app/api/printer/calibrate/route.ts`, tests colocalizados si hay runner
  - Desvío aplicado 2026-10-09 (instrucción del slice: preferir `mantenimiento` única): se creó solo `label-printer-web/src/app/api/printer/mantenimiento/route.ts` (`{accion:"feed"|"calibrar"}`); `feed`/`calibrate` separadas no fueron necesarias.
- No tocar fuera de lo anterior.

## Delivery strategy
- Strategy: ask-on-risk (default). Forecast: ~300-350. Running count: 1059 changed_lines (946+/113- sobre `3106a7b`, 11 paths) — excede presupuesto 400: el assess marcó `slice_budget_reached` y se hizo 1 review consolidada aprobada. Entrega pendiente de decisión humana (push/PR); por tamaño recomiendo PRs encadenados por commits, pero no lo hago sin tu OK.

## Progress
- 2026-10-09: doc creado, 4 tareas. Explorer repo confirma 0 comandos verificados + cuello perf por spawn/fila y argv. Usuario eligió "Cablear con prueba física".
- 2026-10-09: T1 research oficial Zebra hecho (contexto heredado): Avanzar `~PH` suelto, Calibrar `~JC` + `^XA^JUS^XZ`, sin `^MF`, transportes verbatim.
- 2026-10-09: T2 hecho (`78b504d`): ruta `POST /api/printer/mantenimiento` + UI habilitada con aviso y confirmación. Prueba física pendiente.
- 2026-10-09: T3 hecho (`54a0f38`): archivo temporal, lote en 1 send, printers en 1 spawn + cache 3 s, tope 50. Medición en hardware pendiente.
- 2026-10-09: T4 cierre: review aprobada y quemada, docs al día. Doc actualizado (`4a83569` + este cierre).

## Verification evidence
- `npm --prefix label-printer-web run typecheck`: verde tras T2 y tras T3 (tsc --noEmit sin errores; un error intermedio `rawTemplate possibly null` en control/route.ts se corrigió antes del commit T3). Parent spot check: exit 0.
- Tests: omitidos con explicación — `package.json` solo tiene `typecheck`+`build` (+`check` de scripts de preview), sin vitest/jest ni runner utilizable; no se inventó RED/GREEN.
- `queue.status.ts`: verificado sin cambio funcional (1 spawn + `CACHE_TTL_MS` 3 s, sin `force` post-print añadido; mantenimiento no refresca estado).
- Assess: `medium / slice_budget_reached`, 1059 líneas sobre `3106a7b` → preflight + START + consent `granted` + 1 lente `review-reliability` + captura admitida + `acknowledged` (authority `burned`, lineage `review-dc5fda91669c13c7`). 2 WARNINGs informativos (R3-001 pausa-en-resolve, R3-002 sin asserts) como follow-ups, sin corrección.
- Seguimiento fuera de superficie (no tocado, queda para otro slice): comentarios con redacción argv vieja en `csv.ts:201-210` y `quantity-stepper.tsx:9-19` (el número se hereda solo; el texto sigue hablando de base64).

## Commit IDs
- T2: `78b504d` feat(printer): cablear Avanzar y Calibrar via mantenimiento con prueba fisica pendiente
- T3: `54a0f38` perf(printing): envio por archivo temporal, lote en 1 send, printers en 1 spawn, tope 50
- Docs T2+T3: `4a83569`
- T4 cierre doc: pendiente (este edit)

## Next step
- Prueba física en papel (Avanzar gasta 1, Calibrar 1-4 con confirmación) + medición de tiempos de lote en hardware; luego decisión humana de push/PR (recomiendo encadenados por tamaño).
