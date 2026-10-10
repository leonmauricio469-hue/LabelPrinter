# Ajustes rebuild template (mockup 1:1 honesto)

Rebuild de `/settings` EXACTO al mockup visual, sin inventar datos.
Branch: `feat/ajustes-rebuild-template` (desde `consolidacion`).

## Regla de honestidad

- Cableado real: `transport` / `printerName` / `host` / `port`
  (GET /api/printers + GET /api/settings), `mediaWidthMm` (20-170),
  `oscuridad` "~SD" ("" = auto), `retardoEscanerMs` (100-5000),
  `ventanaDuplicadosMs` (0-60000), `sonidoOk` / `sonidoError`,
  `businessName` / `templateId`, Probar (POST /api/printer/test),
  Test-print (POST /api/printer/test-print con confirm, gasta 1),
  Guardar (PUT /api/settings parcial con merge, valida entero).
- UI estatica honesta (badge `mockup · sin datos / no cableado` o
  `disabled` con `title`): DAEMON IPL, LATENCIA USB, 4820 ARTICULOS,
  ruta C:\Papicar, LONGITUD 14.82km, BUFFER, VOLTAJE, RAM, TEMP 58C,
  Exportar/Importar perfil, Auto-imprimir, Conversion ASCII.
- Sin renombrar claves. `oscuridad` string "" valido.
  PUT exige objeto completo tras merge (el cliente manda el objeto
  entero; el servidor mezcla parcial y valida completo).
- Sin `^PQ`, sin `^MF`. `"use client"`, `Link`, `server-only` fuera
  de cliente. Reuso `ui.ts`, `print-status.tsx`,
  `printer-status-banner.tsx`.

## Tareas

- [x] T1 header/perfil — `page.tsx`: header (titulo + pill GX420·USB/Red),
  tarjeta Perfil (`businessName` cableado + Exportar/Importar disabled
  honestos), estado, fetch settings/printers, handlers save/test/test-print.
- [x] T2 seccion 1 dispositivo — `settings-seccion1.tsx`: transport,
  printerName/host/port, mediaWidthMm 20-170 + avisos ^PW, banner real,
  Probar + Test-print, DAEMON IPL / LATENCIA USB estaticos honestos.
- [x] T3 seccion 2 comportamiento — `settings-seccion2.tsx`: oscuridad ~SD,
  retardoEscanerMs, ventanaDuplicadosMs, sonidoOk/Error, Auto-imprimir y
  ASCII disabled honestos.
- [x] T4 seccion 3 catalogo+telemetria — `settings-seccion3.tsx`
  (templateId + width/height legacy + override + 4820/ruta/LONGITUD
  mockup honesto) + `settings-telemetria.tsx` (BUFFER/VOLTAJE/RAM/TEMP
  mockup honesto).
- [x] T5 cierre — `page.tsx`: valida enteros antes de PUT, fila Guardar,
  PrintStatus, Link /editor, typecheck + status + diff.
- [x] **T6** Quitar Ajustes de las dos barras — el rebuild se forkeó desde
  `consolidacion` y perdió la limpieza de nav hecha en el otro branch
  (`ccb573b` global + `e7c9c64` interna). Borrar `Link /settings` en
  `app-nav.tsx` (ambiente: tabs+drawer heredan) y en `centro-impresion.tsx`
  (barra interna de Imprimir). `/settings` sigue vía `Configurar`
  (`app-shell.tsx:91-96`) + URL directa. Sin tocar `app-shell` ni la ruta.
  - Route: delegated direct (mismo writer que T7).
  - Acceptance: ni la barra ambiente ni la interna muestran Ajustes;
    `/settings` abre por Configurar y directo.
  - Checks: typecheck + grep sin `Link href="/settings"` en ambos + visual.
  - Hecho `788199f`: replica exacta de ambos diffs de referencia; grep
    confirma 0 `Link href="/settings"` en los dos ficheros (solo menciones
    en comentarios + `fetch("/api/settings")`, que quedan).
- [x] **T8** Ajustes finos contra referencia stitch (`stitch-ref/.../ajustes_*`,
  `code.html` 33KB + `screen.png`) — operador eligió Perfil compacta (no
  quitar: `businessName` obligatorio e impreso en etiqueta).
  Gaps a cerrar con textos literales de la ref: (a) método `USB - Cola Local
  Win / Spooler RAW passthrough`, `Red / Ethernet IP / Puerto 9100 Direct
  Socket`, `Zebra Bridge Daemon / Servicio local WebSocket`; (b) barra
  inferior `Última sincronización correcta hace X` (real: último PUT ok) +
  `PARAM_CHECKSUM: 0x9AF4B` (estático con badge) + `Restablecer Valores`
  (confirm + vuelve a `DEFAULT_SETTINGS`) + `Guardar Configuración`;
  (c) tarjeta `Feedback Sonoro del Terminal` (`Beep Éxito`/`Alarma Error`
  cableados a `sonidoOk/Error` + `Test Sonido` real); (d) sec3 exacto
  (`4.820 Artículos`, ruta `.sqlite` completa, `Última: Hoy 08:32 AM`,
  texto `Descarga o restaura toda la calibración…`); (e) telemetría con
  subcaptions por tile (`km/Ciclo`, `/128KB/Cola despejada`, `V/Nominal`,
  `MB/ROM OK`) + barra temp; (f) footer `Motor ZPL: Online … DPI: 203 |
  SPEED: 4.0 IPS … PAPICAR S.L. © 2025` (SPEED estático con badge);
  (g) Perfil → fila compacta (empresa editable + plantilla) en vez de
  tarjeta; sensor fijo Web/Gap (sin campo backend).
  - Route: delegated direct (writer trigger).
  - Acceptance: comparada lado a lado con `screen.png`, solo difieren
    badges honestos y pie ASCII real (sin `^CI28` falso); typecheck verde.
  - Checks: typecheck + grep `^PQ`/`^MF`/`server-only` vacíos + visual.
- [x] **T7** Réplica 1:1 del template Image 2 — layout 2 columnas estilo
  ZPL Studio: izquierda secciones 1 (dispositivo: 3 tarjetas de método,
  cola+Detectar+PowerShell, grilla calibración 4 tiles, Probar+Test-print)
  y 2 (comportamiento: 2 tarjetas con toggles + pie); derecha sección 3
  (catálogo: ruta+artículos, sincronización+Recargar, respaldo Export/Import)
  + telemetría (4 tiles + barra temperatura). Barra superior: estado
  conexión+Actualizar, tabs, QUEUE, Soporte; sub-barra: SISTEMA, PERFIL
  ACTIVO, DAEMON, LATENCIA. Todo lo sin fuente con badge honesto, sin
  números vivos falsos.
  - Route: delegated direct (writer trigger).
  - Acceptance: screenshot actual indistinguible en estructura del template;
    todo cableable funciona (Guardar/Probar/Test-print/densidad/tiempos);
    typecheck verde.
  - Checks: typecheck + diff + comparación visual del operador.
  - Hecho `d6c8a76` (ver Progress T6-T7 abajo).

## Progress

- T8 implementada en `feat/ajustes-rebuild-template` (textos literales de
  `code.html`, honestidad intacta): (a) tarjetas de método exactas
  (`USB - Cola Local Win / Spooler RAW passthrough`,
  `Red / Ethernet IP / Puerto 9100 Direct Socket`,
  `Zebra Bridge Daemon / Servicio local WebSocket` solo visual con aviso);
  (b) barra inferior sticky con sync REAL (`lastSyncOk` del PUT ok, relativo
  en español con tick 30s) + `PARAM_CHECKSUM: 0x9AF4B` con badge +
  `Restablecer Valores` (confirm literal ref → `DEFAULT_SETTINGS` clonado,
  sin guardar solo) + `Guardar Configuración`; (c) tarjeta
  `Feedback Sonoro del Terminal` (desc literal, `Beep Éxito`/`Alarma Error`
  = `sonidoOk/Error`, `Test Sonido` → `beepOk()` de `sonido.ts`);
  (d) sec3 exacto (`4.820 Artículos`, ruta `.sqlite` completa,
  `Última: Hoy 08:32 AM`, `Descarga o restaura toda la calibración…`);
  (e) telemetría con subcaptions (`Ciclo: 42%`, `Cola despejada`,
  `Nominal Estable`, `Zebra ROM OK`) + barra temp 58% + nombres de la ref;
  (f) footer `studioFooterClear` (`Motor ZPL: Online`, objetivo =
  `printerName` real o literal ref con badge, `Origen: data/settings.json`
  real con badge sobre el texto ref, `DPI: 203 | SPEED: 4.0 IPS` con badge
  en SPEED, `PAPICAR S.L. © 2025`); (g) Perfil → fila compacta (empresa +
  plantilla/override + /editor, sin tarjeta ni Export/Import — viven en
  sec3); (h) sensor fijo `Web / Gap (Troquel)` + `Separación fija: 3.0mm`
  sin selector, densidad viva de `oscuridad`, pie ASCII real sin `^CI28`.
  Claves intactas, PUT completo con pre-validación, `"use client"`, `Link`,
  `server-only` fuera, `ui.ts` reusado, sin `^PQ`/`^MF`, `xl:grid-cols-2`.
- Mirror Engram PENDIENTE (falla project resolution — no reintentos).
- T6-T7 implementadas en `feat/ajustes-rebuild-template`. T6 replica exacta
  de `ccb573b`/`e7c9c64`. T7: sub-barra SISTEMA + PERFIL ACTIVO real
  (businessName en mayúsculas, `SIN NOMBRE` si vacío) + DAEMON/LATENCIA
  estáticos con badge; grilla `xl:grid-cols-2` (apilada en móvil): izquierda
  sec1 (píldora CONECTADO real desde `/api/printer/status`, 3 tarjetas de
  método — Bridge solo visual con aviso `no cableado`, cola + Detectar
  re-fetch + PowerShell hint `Get-Printer`, calibración 4 tiles con puntos
  reales ancho*8 y slider `oscuridad` real, Probar + Test-print con confirm)
  y sec2 (2 tarjetas con toggles ON estáticos + pie vivo de tiempos, tiempos
  y sonidos cableados); derecha sec3 (ruta/4820/sync estáticos con badge,
  Recargar Ahora real contra `GET /api/products`, Exportar JSON real de
  `GET /api/settings`, Importar disabled, `templateId`/legacy/override
  conservados) + telemetría con UN badge por sección. Claves intactas, PUT
  objeto completo con pre-validación, sin `^PQ`/`^MF`.
- HALLAZGO contra la transcripción: el pie `^CI28 (UTF-8 Remap Activo)` es
  falso — el builder nunca emite `^CI` (ver `ascii.fold.ts`: se eligió
  plegado ASCII + mayúsculas siempre). La tarjeta 2 lo dice así en su pie
  (`Plegado ASCII + MAYÚSCULAS activo · el builder no emite ^CI`); el toggle
  ON estático sigue siendo honesto porque el plegado es incondicional.
- Decisiones que desvían del template a propósito: tarjeta Perfil T1
  conservada (edita `businessName`, alimenta la píldora); header T1
  eliminado (la sub-barra lo reemplaza); aviso genérico `^PW` de sec3
  eliminado (los avisos específicos de sec1 lo cubren); sonidos/`templateId`
  conservados como bloques cableados subordinados (cero regresión).
- Mirror Engram PENDIENTE (falló `mem_save`: project resolution unavailable
  — no reintentado por instrucción del turno).

- T1-T5 implementadas en `feat/ajustes-rebuild-template`. Sin mockup
  visible en el turno (solo la lista del prompt): los items sin fuente
  van como texto estatico con badge `mockup · sin datos / no cableado`.
  Claves intactas, `oscuridad` "" valido, PUT manda objeto completo,
  sin `^PQ`/`^MF` (grep vacio en los 5 ficheros).

## Verification

- T8 `npm --prefix label-printer-web run typecheck`: exit 0, sin errores.
- T8 `git status --short`: 5 ficheros de superficie + doc.
- T8 `git diff --stat`: 5 ficheros + doc (ver commit).
- T8 greps: 0 `^PQ` / 0 `^MF` / 0 `^CI28` / 0 `server-only` en los 5
  ficheros de superficie. Visual del operador: pendiente (lado a lado con
  `screen.png` en máquina con impresora).
- `npm --prefix label-printer-web run typecheck`: exit 0, sin errores (post T7).
- `git status --short` (pre-commit T7): 5 ficheros de superficie + doc;
  tras `d6c8a76`, solo el doc.
- `git diff --stat` (T7 `d6c8a76`): 5 ficheros, 650+/198-.
- Greps: 0 `Link href="/settings"` en `app-nav.tsx`/`centro-impresion.tsx`;
  0 `^PQ`/`^MF` en `src/app/settings` + `src/components`; 0 `server-only`
  en los 4 componentes settings. Visual del operador: pendiente (comparación
  contra Image 2 en máquina con impresora).
- Parent spot check: `typecheck` exit 0 re-corrido; assess `medium /
  slice_budget_reached` (1666 líneas sobre `3106a7b`).
- Review nativa: BLOQUEADA en transporte — consent `granted`, START creado
  (lineage `review-0bae00b3806f0a13`), pero el agente revisor
  `review-reliability` no existe en este runtime y las 2 capturas volvieron
  envueltas (`review_result.lens_results`, sin `subject_hash`/`inspection`)
  = inadmisibles; no se envió nada, no hay receipt, la transacción quedó
  abierta. Vale la verificación del writer + spot check. Reintentar la
  review cuando el runtime ofrezca el agente revisor.

## IDs

- T1 cf619b6 feat(settings): rebuild header y perfil con estado y acciones cableadas
- T2 26f9822 feat(settings): seccion 1 dispositivo con conexion y rollo cableados
- T3 926a036 feat(settings): seccion 2 comportamiento con oscuridad y tiempos cableados
- T4 c7b8821 feat(settings): seccion 3 catalogo y telemetria honesta sin datos
- T5 (cierre doc, este commit)
- T6 788199f fix(nav): quitar Ajustes de barras ambiente e interna en rebuild
- T7 d6c8a76 feat(settings): replica 1:1 del template con cableado honesto
- T6+T7 doc (cierre doc, este commit)
- T8 (commit, este turno) feat(settings): ajustes finos contra referencia stitch
- T8 doc (cierre doc, este commit)
