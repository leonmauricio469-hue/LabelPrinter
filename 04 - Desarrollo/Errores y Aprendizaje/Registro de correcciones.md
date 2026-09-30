---
tipo: indice-correcciones
fecha: 2026-09-29
---
# Registro de correcciones

Estado de cada ficha de [[Mapa de errores y aprendizaje]]. Cada corrección se hizo con TDD: primero un test que reproduce el problema y falla, después el cambio. El detalle (antes, cambio, después, límites) está en la nota de corrección enlazada; el historial de código, en la rama `fix/revision-2026-09-29` y en `CHANGELOG.md`.

**Cómo verificar desde cero** (en `label-printer-web/`): `npm ci`, `npm test`, `npm run typecheck`, y los scripts `node --import ./test/resolve-ts.mjs scripts/check-busqueda.ts` y `scripts/check-barcode-plan.ts`.

**Qué no está verificado:** nada se probó con Windows, la GK420t ni el lector del puesto. La columna "Prueba física" dice qué falta; ver [[M05 - Verificar el resultado con hardware real]].

| Ficha | Estado | Registro | Prueba física |
|---|---|---|---|
| E01, E02, E03 | corregido | [[Correccion E01 E02 E03 - Resolucion de productos]] | escanear 1067 y un UPC-A |
| E04 | corregido | [[Correccion E04 - Cola de escaneos]] | tres escaneos durante una impresión |
| E05 | corregido (provisional) | [[Correccion E05 - Medidas de etiqueta]] | imprimir la medida estándar elegida |
| E06, E18 | corregido | [[Correccion E06 E18 - Texto seguro en ZPL]] | etiqueta con Ñ, É y Ç |
| E08 | corregido | [[Correccion E08 - Code 128 explicito]] | escanear 246, 239 y un alfanumérico |
| E09 | corregido | [[Correccion E09 - Lotes USB por stdin]] | tirada USB de 20+ etiquetas |
| E07 | corregido | [[Correccion E07 - Enviado no es impreso]] | enviar con la cola en pausa |
| E10, E11, E21 | corregido | [[Correccion E10 E11 - Puente nativo del spooler]] | imprimir USB y comparar el ID con la cola de Windows |
| E12, E17 | corregido | [[Correccion E12 E17 - Configuracion segura]] | no necesita |
| E13, E14 | corregido | [[Correccion E13 E14 - Pantalla de configuracion]] | no necesita |
| E15, E16 | corregido | [[Correccion E15 E16 - Estado de la impresora]] | dos pestañas: un solo PowerShell por consulta |
| E25 | corregido | [[Correccion E25 - Aviso de digito de control]] | no necesita |
| E24 | corregido | [[Correccion E24 - Busqueda truncada]] | no necesita |
| E19, E23 | corregido | [[Correccion E19 E23 - Nombre del producto y de la empresa]] | nombres largos en 50×25; etiqueta chica con nombre de empresa |
| E20 | corregido | [[Correccion E20 - Escucha local]] | netstat muestra 127.0.0.1:3000 |
| E22 | corregido | [[Correccion E22 - Reintentos sin duplicados]] | timeout forzado con la cola en pausa |
| M01 | corregido | [[Correccion M01 - Historial reconstruible]] | no necesita |
| E26, E27 | parcial | [[Correccion E26 E27 - Plugins de Obsidian]] | **rotar la clave de Share Note**; reinstalar plugins desde Obsidian |
