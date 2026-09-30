---
tipo: registro-correccion
fichas: [E13, E14]
fecha: 2026-09-29
estado: corregido
prueba-fisica: no
---
# Corrección de E13 y E14 — pantalla de configuración

Fecha: 2026-09-29
Fichas: [[E13 - La pantalla oculta el error de carga]], [[E14 - El campo manual de impresora queda inaccesible]]
Commit: `fix(settings-ui): show load errors with retry and allow typing another queue`

## Comprensión inicial

- **E13:** si `/api/settings` fallaba, se guardaba un error pero `settings` seguía en `null`, y la página devolvía "Cargando configuracion..." para siempre. Tampoco se validaba lo recibido.
- **E14:** la lista de colas siempre agregaba el nombre guardado; con la lista vacía se mostraba un select de un elemento y el campo manual nunca aparecía, justo cuando había que corregir el nombre.

## Antes del cambio

La lógica se extrajo tal cual a `src/app/settings/settings.view.ts`. Tests en `settings.view.test.ts`: error de carga con el motivo del servidor, respuesta sin formato válido, lista vacía → entrada manual, "Otra cola…" siempre disponible, elegirla pasa a entrada manual. Fallaron 5 de 6 (el caso válido ya funcionaba).

## Cambio

- `settingsLoadResult()`: carga lista o error con el motivo del servidor (por ejemplo, el campo inválido que informa [[Correccion E12 E17 - Configuracion segura]]); el cuerpo se valida con el schema.
- La página muestra el error en lugar del formulario, con botón **Reintentar**.
- `queueChoices()`: sin lista → campo manual; con lista → siempre termina en "Otra cola (escribir el nombre)...".
- Guardar se deshabilita mientras guarda (parte de UI de E17).
- El aviso de la sección Etiqueta decía que ancho y alto no cambiaban la etiqueta; desde [[Correccion E05 - Medidas de etiqueta]] sí la cambian. Texto actualizado.

## Después del cambio

6/6 tests; suite y typecheck verdes.

## Cierre

- [x] Caso original corregido. - [x] Relacionados funcionan. - [x] Causa explicada. - [x] Evidencia reproducible.

**Pendientes y límites:** los tests cubren la lógica, no el render del componente. Se comprueba el render con `next build` y la página abierta en el navegador (ver el registro final en [[Registro de correcciones]]).
