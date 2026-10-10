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

## Progress

- T1-T5 implementadas en `feat/ajustes-rebuild-template`. Sin mockup
  visible en el turno (solo la lista del prompt): los items sin fuente
  van como texto estatico con badge `mockup · sin datos / no cableado`.
  Claves intactas, `oscuridad` "" valido, PUT manda objeto completo,
  sin `^PQ`/`^MF` (grep vacio en los 5 ficheros).

## Verification

- `npm --prefix label-printer-web run typecheck`: exit 0, sin errores.
- `git status --short`: solo los 5 ficheros de la superficie + doc.
- `git diff --stat`: page.tsx 162+/303-; 4 componentes nuevos.

## IDs

- T1 cf619b6 feat(settings): rebuild header y perfil con estado y acciones cableadas
- T2 26f9822 feat(settings): seccion 1 dispositivo con conexion y rollo cableados
- T3 926a036 feat(settings): seccion 2 comportamiento con oscuridad y tiempos cableados
- T4 c7b8821 feat(settings): seccion 3 catalogo y telemetria honesta sin datos
- T5 (cierre doc, este commit)
