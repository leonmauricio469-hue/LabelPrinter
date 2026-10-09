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

## Proximo paso
F0.
