# LabelPrinter

Proyecto de aprendizaje para generar etiquetas con catálogo local. Abre esta carpeta como vault en Obsidian y empieza por [[Inicio]]. El código actual está en `label-printer-web/`; el catálogo contiene 3.080 productos.

- [[Mapa de errores y aprendizaje]]: 26 fichas de problemas y riesgos y 6 de mejoras.
- [[Ruta de aprendizaje y correccion]]: orden de estudio y ejercicios.
- [[Conceptos para entender los errores]]: glosario con ejemplos del proyecto.
- [[Como registrar una correccion]]: plantilla para demostrar cada arreglo.
- [[Evidencias y alcance de la revision]]: mediciones y límites de la revisión.
- [[Registro de correcciones]]: estado de cada ficha y qué falta probar en papel.
- [[Plan de prueba fisica]]: lista para el puesto real (Windows, Zebra GK420t, lector).
- `CHANGELOG.md`: todos los cambios desde la revisión, uno por ficha.

## Trabajar con la app

En `label-printer-web/` (Node 24):

| Comando | Qué hace |
|---|---|
| `npm ci` | instala las dependencias exactas del `package-lock.json` |
| `npm run check` | typecheck, tests (`node:test`) y verificación contra el catálogo real; sale con error si algo falla |
| `npm run dev` | la app en `http://127.0.0.1:3000`, solo accesible desde este equipo |
| `npm run build && npm run start` | versión de producción, también solo local |
| `npm run preview -- <barcode>` | vista previa de la etiqueta en `preview/label-preview.png` |

La impresión USB y el estado de la cola necesitan Windows (PowerShell y `winspool.drv`). En otro sistema la app arranca y los tests pasan, pero no imprime por USB.
