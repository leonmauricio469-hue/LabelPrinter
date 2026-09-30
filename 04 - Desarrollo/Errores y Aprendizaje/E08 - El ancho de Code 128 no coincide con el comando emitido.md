---
id: E08
tipo: ficha-aprendizaje
area: etiquetas
prioridad: P1
estado: corregido
verificacion: contrato oficial y calculo en software
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E08 - El ancho de Code 128 no coincide con el comando emitido

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** contrato oficial y calculo en software. **Prioridad:** P1.

## Qué ocurre

Los 561 planes Code 128 calculan menos módulos que el subconjunto B solicitado por el comando actual. En 76 casos, B superaría los 400 dots de papel incluso sin márgenes. Producto 246: plan de 112 módulos frente a 189 en B; a 3 dots son 336 frente a 567 dots.

## Por qué ocurre

El cálculo empaqueta dígitos en subconjunto C. Sin embargo, `^BCN,72,Y,N,N` omite el parámetro de modo y el dato no indica un inicio C. Zebra documenta modo predeterminado N y subconjunto B sin inicio explícito. La simulación mide una codificación distinta de la enviada.

## Dónde estudiarlo

- [src/lib/labels/barcode-plan.ts](../../label-printer-web/src/lib/labels/barcode-plan.ts) · línea 198
- [src/lib/labels/code128.ts](../../label-printer-web/src/lib/labels/code128.ts) · línea 97
- [src/lib/labels/zpl.builder.ts](../../label-printer-web/src/lib/labels/zpl.builder.ts) · línea 98

## Cómo arreglarlo paso a paso

1. Elegir una estrategia de codificación documentada.
2. Para aprender, empezar por un subconjunto explícito y medirlo exactamente.
3. Si se necesitan cambios B/C, producir la secuencia y calcular el ancho a partir de esa misma secuencia.
4. Si se usa modo A, comparar su empaquetado con la medición local, especialmente en datos mixtos.
5. Recalcular centro y zonas quietas; probar casos cercanos al límite.

## Cómo comprobar la solución

Usar `0000180` y `47960195602341`. Comparar símbolos calculados, comando ZPL y ancho esperado. Repetir sobre los 561 planes. Luego imprimir una muestra que incluya datos numéricos pares, impares y mixtos, y escanearla. Los 76 son un cálculo según el contrato documentado, no etiquetas físicas medidas.

## Qué aprender con este error

Aprender a mantener la misma representación en validación y ejecución. Una simulación que se parece al dispositivo puede pasar pruebas y seguir siendo incorrecta.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E05 - Las dimensiones guardadas no cambian la etiqueta]]
- [[E03 - La etiqueta impresa no vuelve al mismo producto]]

## Fuentes

[Zebra: ^BC y sus modos](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-bc.html).

## Corrección

Estado: **corregido**. Registro: [[Correccion E08 - Code 128 explicito]]. Resumen de todas las fichas en [[Registro de correcciones]].
