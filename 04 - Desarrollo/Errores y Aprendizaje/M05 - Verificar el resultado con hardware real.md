---
id: M05
tipo: ficha-aprendizaje
area: pruebas
prioridad: P1
estado: plan-listo-pendiente-de-ejecutar
verificacion: validacion fisica de hallazgos pendiente
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# M05 - Verificar el resultado con hardware real

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** validacion fisica de hallazgos pendiente. **Prioridad:** P1.

## Qué ocurre

Las notas anteriores describen pruebas físicas del proyecto, pero esta revisión se hizo en Linux, sin Zebra ni escáner. Quedan por comprobar glifos, anchos reales de barcode, nombres largos, conteo de copias y banderas de falta de papel o desconexión.

## Por qué ocurre

Un mock verifica cómo responde la aplicación a un dato simulado; no verifica qué dato genera el driver. Una fórmula de ancho sigue un contrato, pero el firmware y el papel pueden revelar diferencias.

## Dónde estudiarlo

- [src/lib/printing/queue.status.ts](../../label-printer-web/src/lib/printing/queue.status.ts)
- [src/lib/labels/label.template.ts](../../label-printer-web/src/lib/labels/label.template.ts)

## Cómo arreglarlo paso a paso

1. Corregir y verificar primero los errores en software.
2. Preparar una lista pequeña de productos representativos: EAN, UPC, Code 128 par/impar, duplicado, corregido, acentos y nombre largo.
3. Imprimir pocas etiquetas y escanear las resultantes; comparar producto y precio.
4. Observar la cola pausada, sin papel y con la impresora apagada según lo permita el puesto.
5. Anotar modelo, firmware, driver, rollo y resultados. No completar la ficha si solo se simuló.

## Cómo comprobar la solución

El registro físico debe responder qué salió, qué leyó el escáner y qué informó la UI. Si el driver no informa una condición, cambiar el mensaje o el método de consulta, no declarar el test aprobado.

## Qué aprender con este error

Aprender límites de las pruebas y diseño de experimentos que separan software, driver, firmware y dispositivo.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E08 - El ancho de Code 128 no coincide con el comando emitido]]
- [[E18 - USB y TCP no usan la misma codificacion]]
- [[E19 - Los nombres largos pueden superponerse]]

## Corrección

Estado: **plan-listo-pendiente-de-ejecutar**. Registro: [[Correccion M02 a M06 - Proceso y documentacion]]. Resumen de todas las fichas en [[Registro de correcciones]].
