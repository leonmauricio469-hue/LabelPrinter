---
tipo: registro-correccion
fichas: [M02, M03, M04, M05, M06]
fecha: 2026-09-29
estado: corregido (M05 pendiente de ejecutar en el puesto)
prueba-fisica: ver M05
---
# Corrección de M02 a M06 — pruebas, control de versiones y documentación

Fecha: 2026-09-29
Fichas: [[M02 - Las pruebas no cubren el ciclo completo ni tienen comando unico]], [[M03 - Preparar control de versiones para aprender]], [[M04 - Mantener la documentacion sincronizada]], [[M05 - Verificar el resultado con hardware real]], [[M06 - Evitar copias y artefactos como fuentes de verdad]]
Commit: `docs: sync project docs, add physical test plan and a single check command`

## M02 — pruebas con comando único

- `npm test`: 101 tests con `node:test`, desde las fuentes, sin dependencias nuevas. Cubren el ciclo imprimir → escanear → mismo producto sobre los 3.080 productos, barcodes duplicados, todos los códigos internos, lotes de 999 etiquetas, transportes con un servidor TCP real, cola de escaneos, caché de estado, configuración e historial sobre directorios temporales.
- `npm run check`: typecheck + tests + `check-busqueda` y `check-barcode-plan` contra el catálogo real.
- Comprobado que falla de verdad: con un test que falla a propósito, `npm test` sale con código 1; en verde, con 0. Los scripts del catálogo también salen con 1 al fallar.
- Los encabezados de los scripts ya no mandan a ejecutar compilados de `.preview-build`.

## M03 — control de versiones

El repositorio ya existía (`leonmauricio469-hue/LabelPrinter`, commits del 2026-09-29 20:23–20:27), con la raíz en `LabelPrinter/`: incluye vault y app, sin repositorios anidados. Se trabajó en la rama `fix/revision-2026-09-29`: un commit con el vault de la revisión tal como estaba, un commit por ficha o grupo de fichas (mensajes en formato convencional con el ID) y este de documentación. Al revisar qué se sube apareció [[E27 - Una clave de Share Note esta publicada en el repositorio]].

## M04 — documentación sincronizada

- [[Mapa de errores y aprendizaje]] ya no dice "todas las correcciones están pendientes": apunta al [[Registro de correcciones]] y aclara que su columna describe cómo se comprobó el problema, no la corrección.
- `README.md`, [[Inicio]], [[Estado del Proyecto]] y [[Proximos Pasos]] dicen que las correcciones están hechas en software y enlazan registro y plan físico. El README explica cómo instalar, verificar y arrancar.
- El informe de `Anexos/` queda marcado como documento histórico: no se actualiza, el estado vive en el registro.
- Se separa siempre "verificado en software" de "probado en el puesto real" (columna de prueba física en el registro).

## M05 — verificación con hardware

[[Plan de prueba fisica]]: 11 productos reales representativos (EAN, UPC-A, dígito corregido, Code 128 par/impar/alfanumérico, duplicado, prefijo, Ñ, nombre más largo, sin código) y 13 pruebas con resultado esperado y fichas relacionadas. **No se ejecutó**: no hay Windows, Zebra ni lector en este entorno. M05 sigue abierta hasta completar el plan.

## M06 — sin copias como fuente de verdad

- Una sola app: `LabelPrinter/label-printer-web/`, documentada en el README.
- `.preview-build/` ignorado en Git; los scripts corren desde las fuentes (`npm run check`, `npm run preview`).
- `data/*.bak` y `data/*.tmp` (respaldo de configuración, E17) ignorados; catálogo, settings e historial siguen versionados, como estaban.

## Cierre

- [x] M02 - [x] M03 - [x] M04 - [ ] M05 (plan listo, falta ejecutarlo) - [x] M06
