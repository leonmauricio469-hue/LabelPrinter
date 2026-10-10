# Registro de Cambios (v2.5)

Log vivo: cada cambio de la linea 2.5 se anota aca con fecha, motivo y evidencia.
Lo anterior (linea 1.x) vive en el vault original.

## 2026-10-10 — Consolidacion del proyecto

- Integradas las ramas de ajustes recientes y busqueda/impresion en el commit `7da95e3`.
- Documentacion 2.5 incorporada a `docs/rediseno-2.5`; raiz unica: `C:\Users\admin\LabelPrinter`.
- Conservados catalogo, plantillas, historial y configuracion de la version activa.
- Integracion inicial validada: typecheck y 11/11 comprobaciones. La validacion final del entorno actualizado se registra en el informe de consolidacion.

## 2026-10-09 — F10-wide Shell full-bleed global

- `anchoCromo` siempre `max-w-none`: todas con la estructura del editor.
  Commit `dc0b903`. Typecheck 0, 8 rutas en 200. Pendiente: alcance de tabs.

## 2026-10-09 — F14 Imprimir exacta cerrada

- Layout del mockup, modos in-place, biblioteca en pill, Soporte real. Commit
  `d415b8b`. Typecheck 0, checks 11/11. Ledger de pendientes: Avanzar/Calibrar
  (render-pendientes), ficha producto, HEAD/RIBBON, firma terminal, KPIs recientes
  (omitidos sin fuente), 4 impresiones fisicas. Queda **F12**.

## 2026-10-09 — F13 Imprimir unificada cerrada

- Buscar+Rapido+Historial+Plantillas+Lotes en `/` (re-composicion verificada),
  nav a 3 tabs, 4 rutas viejas en 404. Commit `e9433ee`. Typecheck 0, checks 11/11.
  Historial runtime limpio (51 registros reales). Queda **F12** (Ajustes).

## 2026-10-09 — F11 Centro unificado cerrada

- Rebuild `/`: modos, pills reales, densidad `~SD`, beeps, anti-duplicados,
  historial reciente. Commit `25e349b`. Typecheck 0, checks 11/11.
  IMPRIMIR AHORA sin invocar. Aparecio plantilla "version 1": confirmar usuario.

## 2026-10-09 — Editor: borrar por fila + fuera ZPL crudo

- × por fila (solo libres, con undo) + volcado `^XA...` fuera de la pestana ZPL.
  Commit `c0df0f4`. Typecheck 0, `/editor` 200.

## 2026-10-09 — F9-sel Click-away cerrada

- `sel` inicial -1, clic al vacio y Escape deseleccionan, cajas OFF por defecto.
  Commit `f3c85ea`. Typecheck 0, `/editor` 200.

## 2026-10-09 — F9-zoom Desfase con zoom cerrado

- Causa: preflight `img{max-width:100%}` encogia la imagen; overlays a `*zoom`.
  Fix `47d4025`: `maxWidth:none` + escala medida. Typecheck 0, `/editor` 200.

## 2026-10-09 — F9-fix Rebuild editor cerrada

- Full-bleed solo `/editor`, header unico, dots en cliente, ayudas colapsables.
  Commit `5cf5e90` (-168 lineas netas). Typecheck 0, checks 11/11, gate estructural
  verificado por padre e hijo. Pendiente: ojos del usuario.

## 2026-10-09 — F9 Editor tal cual Stitch cerrada

- Piel exacta del mockup + undo/redo + barcode fijo Code128 + logo PNG→`^GFA`
  (`pngjs` nuevo). Commit `3cca4dd`. Typecheck 0, checks 11/11, round-trips reales.

## 2026-10-09 — F8b Lineas y rectangulos cerrada

- Kinds `rect`/`line` con `^GB`, toolbox + Eliminar solo-libres, solapes con 422.
  Commit `1c16f80`. Typecheck 0, checks 11/11. Aclarado: el `ok:false` del historial
  es la linea F4 (18:03), ningun intento nuevo de impresion.

## 2026-10-09 — F8a Texto libre cerrada

- `source:"fixed"` + contenido editable + Eliminar solo-fixed en el editor. Commit
  `655deda`. Typecheck 0, checks 11/11. Hallazgo: `^FB` propio por zona (herencia).
  `plantillas.json` restaurado a seed (test F4 desarchivado por mano desconocida;
  copia en temp; confirmar usuario).

## 2026-10-09 — REDISENIO COMPLETO F0–F6

- F6 Editor cerrada (commit `8aad79b`): workbench ClearCraft, reconciliacion con
  activa, `GET /api/editor/zpl`, Origen honesto, Guardar como plantilla, Imprimir
  prueba (sin invocar). Typecheck 0, checks 11/11.
- Cadena completa en `consolidacion`: F0 fundaciones, F1 Imprimir+preview, F2
  Historial, F3 Dispositivos+test, F4 Biblioteca, F5 Lotes, F6 Editor.
- Pendiente del usuario: 4 impresiones fisicas (test-print, templateId, start de
  lote, prueba del editor) y PR hacia `main`. `main` intacta, sin push.

## 2026-10-09 — F5 Lotes cerrada

- CSV con mapeo generico, cola con progreso, pausa/reanudar/cancelar/reintentar.
  Commit `9abff2b`. Typecheck 0, checks 11/11. La ejecucion real imprime: pendiente
  del usuario. Sin ERP (acordado), sin Priorizar.

## 2026-10-09 — F4 Biblioteca cerrada

- Multi-plantilla real: store, CRUD, duplicar, importar (JSON + ZPL raw), `/labels`
  con `templateId`, pagina `/plantillas` con tab propio. Commit `a662202`. Typecheck 0,
  checks 11/11. Impresion con templateID pendiente del usuario. El `.jsonl` con 1 linea
  de prueba fallida no se commitea (runtime).

## 2026-10-09 — F3 Dispositivos cerrada

- Settings re-estilado + `POST /api/printer/test-print` (etiqueta diagnostica real).
  Commit `7e28fc7`. Typecheck 0, checks 11/11, `/settings` 200. La impresion fisica
  de prueba queda en manos del usuario (gasta 1 etiqueta).

## 2026-10-09 — F2 Historial cerrada

- Filtros, detalle con reimprimir (total/subrango) y exportar CSV. Commit `f711a25`.
  Typecheck 0, checks 11/11, `/history` 200 con registros reales.

## 2026-10-09 — F1 Imprimir cerrada

- `GET /api/labels/preview?code=` + `ProductPreview` (ZPL real, aspecto 472:280).
  Commit `2a58650`. Typecheck 0, checks 11/11, preview 200 PNG / inexistente 404.
  El preview devuelve 200 (no 422) para barcodes no imprimibles, igual que imprimir.

## 2026-10-09 — F0 Fundaciones cerrada

- Tokens ClearCraft, fuentes Inter + Plus Jakarta Sans, `AppShell` (topbar + tabs +
  drawer reales). Cero cambio funcional; `main` intacta; commit `b36b8e9` en
  `consolidacion`. Typecheck 0, checks 11/11, 6 rutas en 200.

## 2026-10-09 — Soporte exclusivo GX420

- Decision del usuario: el programa solo soporta la Zebra GX420; otros modelos
  pospuestos hasta nuevo aviso. Simplifica Dispositivos (una sola impresora, sin
  discovery ni Activar/Vincular). Vault actualizado en consecuencia.

## 2026-10-09 — Nace el vault 2.5

- Se crea este vault para seguir el rediseno Stitch/ClearCraft.
- Base: rama `consolidacion` (merge `main` + `ui-redesign` verificado), ajustes de
  plantilla (precio sin `$`, pie alineado), `REF:` con colon (decision del usuario).
- Plan F0–F6 propuesto, estimado 30–45 h. Metodologia de la rueda acordada.

## Plantilla de entrada

```
## AAAA-MM-DD — Titulo
- Que cambio y por que.
- Evidencia: checks / commits / demo.
```
