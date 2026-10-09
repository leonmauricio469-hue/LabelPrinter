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
- [ ] **F3** Dispositivos: settings re-estilado + test ZPL real + estado real (solo GX420).
- [ ] **F4** Biblioteca: modelo multi-plantilla + CRUD + importar + adaptar motor.
- [ ] **F5** Lotes: CSV → mapeo → cola con progreso → historial.
- [ ] **F6** Editor: re-estilado + reconciliacion con override + variables.

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

## Proximo paso
F0.
