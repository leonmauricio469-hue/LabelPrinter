---
id: M02
tipo: ficha-aprendizaje
area: pruebas
prioridad: P2
estado: corregido
verificacion: scripts existentes revisados
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# M02 - Las pruebas no cubren el ciclo completo ni tienen comando unico

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** scripts existentes revisados. **Prioridad:** P2.

## Qué ocurre

Las pruebas existentes pasan: búsqueda 27/27, plan de barcode 32/32 más validación de códigos únicos, y mapa de cola correcto. Aun así no descubren todos los fallos. No hay un comando test que reúna las comprobaciones y evite usar compilados viejos.

## Por qué ocurre

Las pruebas se enfocan en funciones aisladas y algunas reglas de ejemplo. Les faltan límites, ambigüedades, pérdidas de respuesta y propiedades que unan generación con búsqueda. `.preview-build` puede divergir de las fuentes si no se regenera.

## Dónde estudiarlo

- [package.json](../../label-printer-web/package.json)
- [tsconfig.preview.json](../../label-printer-web/tsconfig.preview.json)
- [scripts/check-busqueda.ts](../../label-printer-web/scripts/check-busqueda.ts)
- [scripts/check-barcode-plan.ts](../../label-printer-web/scripts/check-barcode-plan.ts)
- [scripts/check-queue-status.ts](../../label-printer-web/scripts/check-queue-status.ts)

## Cómo arreglarlo paso a paso

1. Crear un comando documentado que ejecute desde fuentes o recompile antes de correr.
2. Mantener pruebas puras de búsqueda y ZPL, sin impresora.
3. Añadir duplicados, todos los códigos internos y el ciclo de E03.
4. Usar transportes simulados para colas, bytes y timeout.
5. Mantener una lista pequeña y explícita de pruebas físicas; no fingir que un mock verifica el dispositivo.

## Cómo comprobar la solución

Hacer fallar una regla conocida en una copia de trabajo y comprobar que el comando devuelve código de salida no cero. Restaurarla y repetir. Todos deben obtener el mismo resultado partiendo de fuentes, no de un archivo compilado anterior.

## Qué aprender con este error

Aprender a evaluar qué demuestra una prueba. Una suite verde respalda sus casos cubiertos, no toda la aplicación.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E03 - La etiqueta impresa no vuelve al mismo producto]]
- [[E04 - Los escaneos pendientes se sobrescriben]]
- [[E09 - Los lotes USB exceden el limite de argumentos]]

## Corrección

Estado: **corregido**. Registro: [[Correccion M02 a M06 - Proceso y documentacion]]. Resumen de todas las fichas en [[Registro de correcciones]].
