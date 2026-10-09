# Redisenio Stitch/ClearCraft — linea 2.5

## Objetivo
Nueva piel ClearCraft (modo claro) sobre las 5 pantallas Stitch, con todos los botones
funcionando de verdad. El motor 1.x no se reescribe.

## Problema / por que
La UI actual es funcional pero basica (6 rutas, sin lotes, sin biblioteca, historial y
settings minimos). Las maquetas Stitch definen el objetivo visual; el plan F0–F6 lo
lleva a codigo por fases, siempre en verde.

## Alcance autorizado
- Rama de trabajo: `consolidacion`. `main` intacta. Sin push.
- F0: solo fundaciones visuales. **Cero cambio funcional**: ningun cambio en `src/lib/**`,
  `src/app/api/**`, `data/**`, ni comportamiento de paginas.
- Detalle de alcance por pantalla: vault 2.5 `01 - Requisitos/Alcance y Recortes.md`.
- Decisiones vigentes: vault 2.5 `01 - Requisitos/Pendientes de Alcance.md`
  (rueda, GX420 exclusivo, precio sin `$`, `REF:` con colon, XPRO, HTML solo referencia).

## Restricciones
- Piel SI, fantasia NO: ningun dato inventado, ningun boton decorativo.
- F0 no agrega tabs ni botones sin destino real (sin `/plantillas`, sin `/lotes` aun).
- Fuentes via `next/font` con fallback a system stack si no hay red en build.
- Regla de `label-printer-web/AGENTS.md`: leer la guia de Next en
  `node_modules/next/dist/docs/` antes de escribir codigo (aplica a cada implementador).
- Test-first: F0 no cambia comportamiento → excepcion documentada; valen typecheck +
  `npm run check` + spot visual en `:3000`.

## Ruta
Delegated direct (trigger: 2+ archivos no triviales). Un writer por fase. Verificacion
del writer + spot check del padre antes de cada commit de unidad.

## Checklist

- [x] **F0** Fundaciones: tokens ClearCraft en `globals.css`, fuentes, `AppShell`
  (topbar + tabs + drawer con contenido real), navegacion de las 6 rutas actuales.
- [x] **F1** Imprimir simple: `/` re-estilado + preview real + pill de impresora.
- [x] **F2** Historial potenciado: filtros, detalle, reimprimir rango, exportar CSV.
- [x] **F3** Dispositivos: settings re-estilado + test ZPL real + estado real (solo GX420).
- [x] **F4** Biblioteca: modelo multi-plantilla + CRUD + importar + adaptar motor.
- [x] **F5** Lotes: CSV → mapeo → cola con progreso → historial.
- [x] **F6** Editor: re-estilado + reconciliacion con override + variables.
- [ ] **F8** Editor vectorial acotado (por objetos, 1 a 1):
  - [x] **F8a** Texto libre fijo (agregar/borrar/editar contenido en canvas).
  - [x] **F8b** Lineas y rectangulos libres (todo con `^GB`, sin parser nuevo).
- [x] **F11** Centro unificado de impresion (rebuild `/`: scan+modos+preview+historial
  reciente, tal cual mockup `imprimir_centro_unificado`).
- [ ] **F12** Ajustes rebuild (tal cual mockup `ajustes_configuracion`, sin telemetria
  inventada).
- [x] **F9-fix** Rebuild del editor (full-bleed, header unico, dots calculados, ayudas
  colapsables) + gate estructural de layout.
- [x] **F9-zoom** Fix desfase con zoom: imagen a tamano exacto (`maxWidth:none` vs
  preflight) + puntero con escala medida (`pxPorDot`), no asumida.
- [x] **F9-sel** Click-away/Deselect: clic al vacio y Escape deseleccionan; arranque sin
  seleccion; cajas de referencia apagadas por defecto.
- [x] **F10-wide** Shell full-bleed global (misma estructura del editor en todas;
  se acabaron los oceanos de gris). typecheck 0, 8 rutas en 200.
- [x] **F13** Imprimir unificada: Buscar+Rapido+Historial+Plantillas+Lotes en una sola
  pantalla (re-composicion verificada linea por linea); nav a 3 tabs.
- [x] **F14** Imprimir EXACTA al mockup `imprimir_centro_unificado` (reemplaza hub-tabs:
  modos in-place, biblioteca en pill, historial embebido; funciones pendientes con
  ledger honesto, nada fingido).
- [ ] **F10** Rollout fino por pantalla (si hiciera falta mas alla del ancho).
- [x] **F9** Editor tal cual Stitch (piel exacta del mockup `stitch_panel_editor`):
  barcode de contenido fijo (Code128) + logo cambiable (upload PNG→`^GFA`) + undo/redo.

## Aceptacion F0
- `npm run typecheck` exit 0; `npm run check` 11/11 verdes.
- Las 6 rutas (`/`, `/fast`, `/editor`, `/history`, `/settings`, `/teclado`) responden 200
  y conservan su funcionalidad exacta.
- Cero numeros inventados (sin temperaturas, sin % de ribbon, sin telemetria).
- Ningun tab ni boton sin destino real.

## Progreso y evidencia
- **F0** (commit `feat(ui): F0 fundaciones ClearCraft (tokens, fuentes, AppShell)` en
  `consolidacion`): writer delegado. typecheck exit 0 (writer + spot check del padre),
  `npm run check` 11/11 (writer), 6 rutas en 200 (writer). Nota: el shell monta una
  instancia extra de `PrinterStatusBanner` (un sondeo mas cada 20 s); extraer el hook
  queda como mejora futura, no bloquea.
- Siguiente paso: **F1**.
- **F1** (commit `feat(ui): F1 pantalla Imprimir con preview del ZPL real` en
  `consolidacion`): writer delegado. Nuevo `GET /api/labels/preview?code=` (mismo lookup
  y plantilla que al imprimir, sin imprimir ni auditar) + `ProductPreview` (aspecto
  472:280, estados honesto/cargando/error real). typecheck exit 0 (writer + padre),
  `npm run check` 11/11 (writer), `/` 200, preview 200 `image/png` (writer + padre),
  inexistente 404 (writer + padre). Desvio documentado: el preview devuelve 200 (no 422)
  para barcodes no imprimibles, igual que la impresion (etiqueta sin barras + aviso).
  Ademas se quito el `PrinterStatusBanner` duplicado de `/` (el pill vive en el shell).
- Siguiente paso: **F2**.
- **F2** (commit `feat(ui): F2 historial potenciado con detalle y reimpresion` en
  `consolidacion`): writer delegado. KPIs contados de lo cargado, filtros reales
  (texto/estado/limite 100-200-500), paginacion cliente x25, `HistoryDetail` (campos
  reales + preview regenerado con caption honesto + reimprimir total/subrango +
  exportar CSV cliente con columnas reales). typecheck 0 (writer + padre), check 11/11,
  `/history` 200 y API con shape verificado (padre). Sin ZPL guardado (no existe en el
  registro), sin telemetria.
- Siguiente paso: **F3**.
- **F3** (commit `feat(ui): F3 dispositivos con etiqueta de prueba real` en
  `consolidacion`): writer delegado. Settings re-estilado (todos los controles
  intactos, una sola impresora, sin discovery ni telemetria) + nuevo
  `POST /api/printer/test-print` (ZPL diagnostico minimo con `^PW` real, via el mismo
  transporte, sin auditar) + boton con confirmacion. typecheck 0 (writer + padre),
  check 11/11, `/settings` 200 (padre). Endpoint NO invocado (imprime de verdad):
  impresion fisica pendiente del usuario.
- Siguiente paso: **F4**.
- **F4** (commit `feat(ui): F4 biblioteca multi-plantilla con CRUD e importacion` en
  `consolidacion`): writer delegado. Nuevo store `plantillas.json` (semilla 59x35),
  activa = `settings.label.templateId` existente, `templateForPrint(id?)`, APIs
  templates CRUD/duplicar/importar(JSON redondeo + ZPL raw honesto), `/labels`
  con `templateId?` (estructurada o raw verbatim), preview con `?template=`,
  pagina `/plantillas` con filtros/detalle/Usar/Duplicar/Archivar/Importar/Blanco.
  typecheck 0 (writer + padre), check 11/11, round-trip CRUD real verificado, lista
  final limpia (pruebas archivadas). Desvios aceptados: `templateForPrint` vive en
  `label-override.store.ts` (fuera de superficies, es su hogar natural); `templateId?`
  en `route.ts` (schemas.ts lo compila preview); settings se lee a mano (evita `@/*`
  en preview build); tab Plantillas + IconGrid agregados por el padre. NO verificado:
  `POST /api/labels` con templateId imprime de verdad (pendiente usuario). Auditoria:
  aparecio 1 linea `ok:false` (intento fallido sin impresora, sin papel gastado) de una
  prueba no reportada del writer; se conserva por ser registro fiel, no se commitea el
  `.jsonl` (artefacto de runtime).
- Siguiente paso: **F5** (requiere alcance #4 columnas CSV y #5 ERP).
- **F5** (commit `feat(ui): F5 lotes con CSV, mapeo y ejecucion con progreso` en
  `consolidacion`): writer delegado. Store `lotes.json` + parser CSV (coma/punto-coma,
  comillas, resolucion por fila con el lookup real), APIs import/CRUD/control
  (start/pause/resume/cancel/retry, 409 si otro activo, reconcilia huerfanos),
  pagina `/lotes` en 3 pasos (subir → mapear → crear) + detalle con progreso y
  reintento de fallidos. typecheck 0 (writer + padre), check 11/11, round-trip sin
  imprimir verificado (import/crear/cancelar, store restaurado, historial intacto).
  Tab Lotes + IconStack agregados por el padre. NO verificado: start/pause/resume
  ejecutan de verdad (pendiente usuario). Sin Priorizar (documentado: otro producto).
- Siguiente paso: **F6**.
- **F6** (commit `feat(ui): F6 editor reconciliado con biblioteca y pestanas ZPL-Origen` en
  `consolidacion`): writer delegado. Workbench ClearCraft (comportamiento intacto) +
  reconciliacion con activa (raw/otra → aviso honesto) + `GET /api/editor/zpl`
  (ZPL real + Copiar) + Origen con fuentes reales (sin CSV/ERP/RFID/simulacion; `~SD`
  recortado por no verificable) + Guardar como plantilla (via import JSON) +
  Imprimir prueba (confirmacion, sin invocar). typecheck 0 (writer + padre), check
  11/11, `/editor` 200 y ZPL `^XA..^XZ` verificados por el padre, round-trip con
  biblioteca limpia (seed restaurado). Desvios: Guardar usa import (templates POST no
  transporta geometria); ZPL refleja lo guardado (aviso en UI si hay sin aplicar).
- **REDISENIO COMPLETO F0–F6.** Pendiente del usuario: impresiones fisicas
  (test-print, templateId, start de lote, prueba del editor) y PR hacia `main`.
- **F8a** (commit `feat(editor): F8a texto libre fijo en canvas` en `consolidacion`):
  writer delegado. `source:"fixed"` + `text` (1–60) en tipos y schema; builder emite
  tal cual (ASCII, sin mayusculas); toolbox agrega, propiedades editan contenido,
  Eliminar solo fixed (core protegidas). typecheck 0 (writer + padre), check 11/11,
  round-trip real (apply/preview/zpl con la fija, override restaurado). Hallazgo fino:
  cada zona de texto debe emitir su `^FB` propio (hereda el anterior en la impresora).
  Desvios aceptados: 3 scripts de check adaptados (paridad de schema + union de tipos).
  Limpieza: `plantillas.json` volvio a seed (test F4 desarchivado por mano desconocida,
  copia en temp; confirmar que no fue el usuario).
- Siguiente paso: **F8b** (a definir: lineas/rectangulos u otro objeto).
- **F8b** (commit `feat(editor): F8b rectangulos y lineas libres con ^GB` en
  `consolidacion`): writer delegado. Kinds `rect`/`line` (grosor 1–5, todo `^GB`;
  diagonales/elipses recortadas por parser), toolbox + panel + Eliminar solo-libres,
  solapes incluidos (422 honesto, probado sobre el precio). typecheck 0 (writer +
  padre), check 11/11 sin adaptar, round-trip real + override restaurado. Toques
  declarados: `label.render.ts` (cola de etiquetas por orden) + shim de tipos
  `maxWidthDots?: never`. Arrastre a raton no verificado con clics (geometria espeja
  al shape). Correccion: el writer atribuyo al padre un `ok:false` del historial, pero
  la cola prueba que es la linea F4 del 18:03 — ningun intento nuevo, nada que explicar.
- Siguiente paso: **F8c** (a definir) o cierre de la linea vectorial.
- **F9** (commit `feat(editor): F9 editor tal cual Stitch + barcode fijo + logo PNG` en
  `consolidacion`): writer delegado. Piel exacta del mockup (header, insertar, zonas
  con roles, reglas, validador con sym/quiet reales, footer real, version real 1.2.0)
  + undo/redo por snapshots + barcode fijo Code128 con HRI pareada + upload PNG→`^GFA`
  (`pngjs`, nueva dep). typecheck 0 (writer + padre), check 11/11, round-trips reales
  (barcode fijo, logo 16x8 convertido y validado contra solapes, override restaurado).
  Arrastre/undo a clics sin verificar (declarado). Decisiones del usuario aplicadas:
  barcode = contenido editable, logo = cambiable via upload.
- Siguiente paso: **lo que pidas** (F8c, pruebas fisicas o PR a `main`).
- **F11** (commit `feat(ui): F11 centro unificado de impresion` en `consolidacion`):
  writer delegado. `/` rebuild (modos navegables, pills reales, scan+qty+preview,
  densidad `~SD` condicional, beeps WebAudio, anti-duplicados, historial reciente).
  typecheck 0 (writer + padre), check 11/11, settings round-trip restaurado,
  `GET /api/printers` con JobCount real. Recortes: telemetria producto/HEAD/ribbon,
  Avanzar/Calibrar, buffer, ERP. Desvio: `validation/schemas.ts` extendido (necesario).
  NO verificado: IMPRIMIR AHORA (imprime). `plantillas.json` trae "version 1" de mano
  desconocida: sin commitear hasta confirmar usuario.
- Siguiente paso: **F12** (Ajustes rebuild).
- **F10-wide** (commit `fix(ui): shell full-bleed global, misma estructura del editor`
  en `consolidacion`): `anchoCromo` siempre `max-w-none`. typecheck 0, 8 rutas en 200.
- Siguiente paso: **definir alcance de pantallas** (pregunta al usuario) + **F12**.
- **F9-fix** (commit `fix(editor): rebuild full-bleed con header unico y gate estructural`
  en `consolidacion`): writer delegado. Shell wide solo para `/editor`, header propio
  volado (1 nav, 1 pill), dots calculados en cliente (la API solo da mm), ayudas en
  `<details>`, grid `288/1fr/320` + `min-w-0`. typecheck 0 (writer + padre), check
  11/11, gate estructural re-corridos por el padre (1 nav, fullbleed presente,
  0 dots vacios). Logica y contratos intactos.
- Siguiente paso: **tus ojos** en `/editor` + **F10** rollout al resto.
- **F13** (commit `feat(ui): F13 Imprimir unificada, nav a 3 tabs` en `consolidacion`):
  writer delegado (el primer intento pego rate-limit tras dejar el trabajo hecho; el
  segundo lo verifico linea por linea). 4 paginas movidas a secciones (paridad 0
  lineas faltantes salvo plantillas: era Server Component, se alimenta por endpoints),
  4 page.tsx borrados, nav a 3, hrefs rotos del editor corregidos, comentario rancio
  del shell actualizado por el padre. Scanner unico verificado (montaje excluyente).
  typecheck 0 (writer + padre), check 11/11, `/?tab=` x5 en 200, 4 rutas en 404,
  endpoints iguales. Cero logica nueva, cero cambios en lib/api/data.
- Siguiente paso: **F12** (Ajustes rebuild).
- **F14** (commit `feat(ui): F14 Imprimir exacta al mockup` en `consolidacion`): writer
  delegado. Modos in-place (mismo codigo), biblioteca en pill, preview+buffer real,
  historial embebido+expandible, Soporte real, footer real. Hub-tab-bar eliminada
  (orden directa). typecheck 0 (writer + padre), check 11/11, gate estructural
  re-corrido por el padre (3 marcadores, tab-bar ausente). Deuda conocida: `<main>`
  anidado (secciones intactas, solo HTML).
- **F9-sel** (commit `fix(editor): click-away y arranque sin seleccion` en
  `consolidacion`): `sel` inicial -1 (verificado null-safe en marco/panel/teclado),
  clic al vacio y Escape deseleccionan (sin gesto ni undo), cajas de referencia OFF
  por defecto. typecheck 0, `/editor` 200.
- **F9-zoom** (commit `fix(editor): cajas exactas a todo zoom (maxWidth:none + escala medida)`
  en `consolidacion`): causa raiz = preflight `img{max-width:100%}` encogia la imagen y
  los overlays iban a `*zoom` nominal (1x bien, 6x roto). Fix en `page.tsx` + cursor
  con `pxPorDot()`. typecheck 0, `/editor` 200.

## Proximo paso
F0.
