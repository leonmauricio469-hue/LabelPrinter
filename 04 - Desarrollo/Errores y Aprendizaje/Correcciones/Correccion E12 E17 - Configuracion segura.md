---
tipo: registro-correccion
fichas: [E12, E17]
fecha: 2026-09-29
estado: corregido
prueba-fisica: no
---
# Corrección de E12 y E17 — leer y guardar la configuración de forma segura

Fecha: 2026-09-29
Fichas: [[E12 - Leer settings acepta objetos incompletos]], [[E17 - Guardar settings puede dejar el archivo incompleto]]
Commit: `fix(settings): validate on read and save atomically with a backup`

## Comprensión inicial

- **E12:** `{ ...DEFAULT_SETTINGS, ...archivo }` combina solo el primer nivel. `{ printer: { transport: "usb" } }` borraba `printerName` y el resto de valores de la impresora, y nada se validaba.
- **E17:** `fs.writeFile` directo sobre el archivo en uso: un lector simultáneo o un corte podían dejarlo truncado.

## Antes del cambio

La lógica se movió sin cambios a `src/lib/settings/settings.file.ts` (recibe la ruta, se prueba sobre un directorio temporal real). Tests en `settings.file.test.ts`:

| Caso | Antes |
|---|---|
| archivo parcial conserva defaults por sección | falla: `printerName` ausente |
| valor inválido (`transport: "fax"`) se rechaza nombrando el campo | falla: se aceptaba |
| JSON corrupto se informa con el nombre del archivo | falla: error genérico de `JSON.parse` |
| guardar deja `.bak` con la versión anterior y ningún temporal | falla: no había respaldo |
| 20 guardados concurrentes: gana el último | pasa (queda como guarda) |

## Cambio

- Lectura: defaults combinados **por sección**, resultado validado con el mismo schema que usa `PUT /api/settings`. Un archivo que existe pero es inválido es un error con el campo exacto y cómo recuperarlo (`settings.json.bak`), no un regreso silencioso a los defaults.
- Escritura: temporal en el mismo directorio + `rename` (reemplazo atómico en el mismo sistema de archivos), copia previa en `settings.json.bak`, guardados en cola.
- `/api/settings`, `/api/printer/test` y `/api/labels` devuelven ese mensaje como 500 legible.
- `.gitignore` excluye `data/*.bak` y `data/*.tmp`.

## Después del cambio

Los 6 tests pasan; suite y typecheck verdes.

## Cierre

- [x] Caso original corregido. - [x] Relacionados funcionan. - [x] Causa explicada. - [x] Evidencia reproducible.

**Pendientes y límites:** la atomicidad viene de la construcción (`rename`), no de un test que pudiera fallar: provocar un lector en el instante exacto de la escritura no es reproducible. El botón Guardar bloqueado mientras guarda se resuelve con [[Correccion E13 E14 - Pantalla de configuracion]].
