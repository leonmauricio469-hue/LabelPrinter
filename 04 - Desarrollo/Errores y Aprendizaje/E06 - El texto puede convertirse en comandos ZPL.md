---
id: E06
tipo: ficha-aprendizaje
area: etiquetas
prioridad: P2
estado: corregido
verificacion: reproducido en software
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E06 - El texto puede convertirse en comandos ZPL

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** reproducido en software. **Prioridad:** P2.

## Qué ocurre

Un nombre como `CAFE^FS^XZ` genera `^FDCAFE^FS^XZ^FS`: los caracteres del nombre pueden cerrar el campo y la etiqueta. En el catálogo revisado no se encontraron `^` ni `~` en nombres; el caso se reprodujo con un dato de prueba.

## Por qué ocurre

El constructor concatena datos dentro de un lenguaje de comandos sin escapar sus caracteres especiales. Zod comprueba tipo y longitud, pero no cambia cómo la impresora interpreta el texto.

## Dónde estudiarlo

- [src/lib/labels/zpl.builder.ts](../../label-printer-web/src/lib/labels/zpl.builder.ts) · línea 127
- [src/lib/validation/schemas.ts](../../label-printer-web/src/lib/validation/schemas.ts) · línea 10

## Cómo arreglarlo paso a paso

1. Separar la composición de comandos de la representación de texto.
2. Implementar una función para campos de texto que codifique los bytes problemáticos mediante el mecanismo hexadecimal `^FH`, según ZPL.
3. Escapar también el carácter elegido como indicador hexadecimal y tratar aparte las secuencias especiales de `^FB`.
4. Para barcode, respetar además sus códigos de invocación; no reutilizar a ciegas el escape de texto.
5. Coordinarlo con la codificación de E18.

## Cómo comprobar la solución

Generar etiquetas con `^`, `~`, el indicador hexadecimal, barra invertida y saltos de línea. El texto no debe introducir nuevos bloques `^XA`/`^XZ`. Verificar la lectura de barcode por separado. La etiqueta física debe representar los caracteres esperados.

## Qué aprender con este error

Aprender la diferencia entre validar datos y escaparlos para un lenguaje concreto. El mismo problema aparece en HTML, SQL y comandos de shell.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E18 - USB y TCP no usan la misma codificacion]]

## Corrección

Estado: **corregido**. Registro: [[Correccion E06 E18 - Texto seguro en ZPL]]. Resumen de todas las fichas en [[Registro de correcciones]].
