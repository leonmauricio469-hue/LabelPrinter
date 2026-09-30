---
id: M01
tipo: ficha-aprendizaje
area: trazabilidad
prioridad: P3
estado: pendiente
verificacion: mejora identificada en codigo
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# M01 - El historial no permite reconstruir la etiqueta

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** mejora identificada en codigo. **Prioridad:** P3.

## Qué ocurre

El historial guarda código, nombre, cantidad y un booleano de resultado. No guarda el precio utilizado, el barcode realmente emitido, sus avisos o la versión de plantilla. Si cambia el catálogo, no se puede reconstruir qué se envió antes.

## Por qué ocurre

Se registra solo el resultado general y se depende del estado actual del catálogo para interpretar el pasado. El UUID generado es un ID del registro, no el ID del spooler de Windows.

## Dónde estudiarlo

- [src/lib/audit/audit.store.ts](../../label-printer-web/src/lib/audit/audit.store.ts) · línea 11
- [src/app/api/labels/route.ts](../../label-printer-web/src/app/api/labels/route.ts)

## Cómo arreglarlo paso a paso

1. Añadir un snapshot pequeño: precio, identificador emitido, avisos y versión de plantilla.
2. Separar ID de solicitud, ID de auditoría e ID de spooler.
3. Registrar el estado real conocido según E07, sin inventar confirmación física.
4. Versionar el formato para seguir leyendo líneas anteriores.
5. Considerar rotación o lectura del final cuando el historial crezca; no hace falta migrarlo a una base de datos ahora.

## Cómo comprobar la solución

Enviar un trabajo simulado, cambiar el precio del catálogo de prueba y revisar el registro anterior. Debe conservar el precio original y el barcode usado. Probar lectura de un registro viejo y una línea corrupta.

## Qué aprender con este error

Aprender snapshots, versionado de datos y observabilidad. Un log útil responde preguntas concretas del usuario.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E07 - Enviado no significa impreso]]
- [[E10 - La firma nativa de StartDocPrinter es incorrecta]]
