# Feature: ajustes-diseno-funcional

## Objective
Rediseño funcional de Ajustes con criterio frontend-design: quitar lo que no se puede usar y llevar la biblioteca de plantillas a Ajustes para verla y usarla ahí.

## Problem
- Quedan 8 focos muertos/engañosos con badge (toggles, ruta/carpeta, pills DPI, telemetría, Bridge, width/height legacy, DAEMON/LATENCIA).
- La biblioteca real (`TemplateLibrary`: ver/elegir/crear/duplicar/archivar/usar/importar/exportar) vive en `/?tab=plantillas`; Ajustes solo tiene un select legacy de 1 opción del código (`TEMPLATES`), desactualizado.

## Why
Operador: pantalla 100% funcional + plantillas visibles y usables desde Ajustes.

## Scope
- T1: quitar lo no usable (notas compactas donde aportan, sin badges colgando).
- T2: sección Plantillas en Ajustes (embeber `SeccionPlantillas`/`TemplateLibrary` + select real desde `GET /api/templates` con `Usar` = `PUT settings {label.templateId}`).
- T3: pasada frontend-design (tokens, restraint, crítica; el brief stitch manda donde fija dirección).
- Sin backend nuevo, sin claves nuevas, sin papel. Endpoints existen (sin DELETE por diseño: archivar).

## Constraints
- Claves intactas, PUT objeto completo, `"use client"`, `server-only` fuera de cliente, sin `^PQ`/`^MF`/`^CI`, español neutro en UI (proyecto en español), responsive, foco visible, reduced motion.
- No tocar fuera de las superficies. No `push`/PR/merge.

## Tasks
- [x] **T1** Quitar muertos — toggles→notas, ruta/carpeta fuera, Bridge fuera, width/height fuera, DPI→texto único, DAEMON/LATENCIA fuera, telemetría fuera, checksum REAL calculado (FNV-1a del settings, rotulado) en vez de mockup.
  - Route: delegated direct (writer trigger).
  - Acceptance: cero `disabled` decorativos ni badges `mockup`; typecheck verde.
  - Checks: typecheck + grep `mockup|no cableado` vacío en settings + visual.
  - Outcome (2026-10-10): hecho en `3a3414a`. Grep vacío en las 4 superficies (se corrigió 1 resto en comentario) + typecheck verde.
- [x] **T2** Plantillas en Ajustes — sección con biblioteca embebida + select real + Usar.
  - Route: delegated direct (mismo writer).
  - Acceptance: ver/crear/duplicar/archivar/usar/importar/exportar desde Ajustes; elegir activa y refleja en pill + impresión.
  - Checks: typecheck + prueba manual sin papel.
  - Outcome (2026-10-10): hecho en `126cc54`. `SeccionPlantillas` embebida sin tocarla (remount por `key={templateId}`); select lee `GET /api/templates` (200, 3 no archivadas en smoke test) y Usar hace `PUT` objeto completo (200, claves intactas, verificado por round-trip). CRUD completo reutilizado de `TemplateLibrary`, sin papel.
- [x] **T3** Pasada diseño — tokens intencionales identidad industrial, restraint (quitar un adorno), foco/reduced-motion, copy mínima.
  - Route: delegated direct (mismo writer).
  - Acceptance: sin defaults genéricos (SaaS-cards, eyebrow ALL-CAPS, `→`); typecheck verde.
  - Checks: typecheck + visual operador.
  - Outcome (2026-10-10): hecho en `b96b088`. Placas acero #2F3336 + seguridad #F5B301 como único gesto; sub-barra sin cromo de tarjeta (adorno quitado); sentence case en titulares/labels/botones; `→` ausente y `·` solo en el literal `203 DPI · 8 dots/mm` fijado por brief; `motion-reduce` en loader; foco visible global intacto. Visual operador pendiente del parent.
- [x] **T4** Cierre — commits por tarea, assess, verificación enfocada.
  - Route: delegated direct (writer self-verification + parent spot check).
  - Acceptance: commits convencionales con IDs abajo; sin TODO nuevos.
  - Checks: verification del writer + `git status` + assess.
  - Outcome: parent spot check `typecheck` exit 0; assess `medium/slice_budget_reached` (731 líneas) → review `reliability` APROBADA y QUEMADA (lineage `review-acfd44a5a0e41834`, ver abajo).
- [ ] **T5** Follow-ups de la review (informativos, sin corrección ofrecida) — (a) `usar()` en seccion3 aplica el template en estado local antes del PUT: si el PUT falla, la UI muestra el nuevo como activo aunque el error diga que nada cambió; (b) el dropdown de plantillas de seccion3 carga una vez al montar y queda viejo tras crear/archivar en la sección 4 hasta recargar. Sin papel, sin backend nuevo.

## Authorized scope
- Editar: `label-printer-web/src/app/settings/page.tsx`, `label-printer-web/src/components/settings-seccion1.tsx`, `label-printer-web/src/components/settings-seccion2.tsx`, `label-printer-web/src/components/settings-seccion3.tsx`, `label-printer-web/src/components/settings-telemetria.tsx` (puede eliminarse si la sección sale)
- No tocar fuera de lo anterior (reusar `SeccionPlantillas`/`TemplateLibrary` sin editarlos; si requieren cambio, parar e informar).

## Delivery strategy
- Strategy: ask-on-risk (default). Forecast: ~300 authored lines. Running count: ~300 (T1+T2+T3 + doc). Slice: single-pr previsto salvo assess.

## Progress
- 2026-10-10: doc creado, 4 tareas. Branch `feat/ajustes-diseno-funcional` desde `feat/ajustes-fase1`. Biblioteca confirmada completa (store `plantillas.json` + endpoints sin DELETE por diseño + ida/vuelta editor).
- 2026-10-10: T1+T2+T3 hechos por writer (3 commits, sin push). `SeccionPlantillas`/`TemplateLibrary` no necesitaron cambios (se reutilizaron intactos). Mirror Engram PENDIENTE (falla project resolution — no reintentar `mem_save` desde este writer).
- 2026-10-10: T4 parent — spot check verde, assess abajo, doc trackeado en este commit.

## Verification evidence
- `npm --prefix label-printer-web run typecheck`: verde (tsc --noEmit sin errores) tras T1, T2 y T3.
- `grep mockup|no cableado` vacío en `src/app/settings` + `src/components/settings-seccion{1,2,3}.tsx` (1 resto en comentario corregido en T1).
- Smoke sin papel contra dev server :3000: `GET /api/templates` → 200 con 3 plantillas no archivadas (id/name/widthMm presentes); `PUT /api/settings` round-trip con mismo `templateId` → 200 con todas las claves intactas. El PUT añadió claves raíz por defecto al `settings.json` en disco y se revirtió (`git checkout`) para dejar el árbol como estaba.
- `git status --short`: limpio salvo este doc sin trackear. `git diff --stat`: vacío.
- Commits: `3a3414a` feat(ajustes): quitar muertos y checksum real FNV-1a; `126cc54` feat(ajustes): plantillas reales en Ajustes; `b96b088` style(ajustes): identidad de taller e copy en sentence case. Sin Co-Authored-By, sin TODO nuevos, sin `^PQ`/`^MF`/`^CI` nuevos (se eliminó la única mención en copy).
- Review `review-acfd44a5a0e41834`: APROBADA y QUEMADA, lente reliability, 0 bloqueantes; 2 SUGGESTIONs = T5 arriba. Sin corrección ofrecida.
- Visual operador pendiente (parent).

## Next step
- Probar en `http://localhost:3000/settings` (visual + plantillas + sin papel); si va bien, push + PR (tu decisión).
