---
id: E05
tipo: ficha-aprendizaje
area: etiquetas
prioridad: P2
estado: corregido-provisional
verificacion: confirmado por lectura del codigo
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E05 - Las dimensiones guardadas no cambian la etiqueta

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** confirmado por lectura del codigo. **Prioridad:** P2.

## Qué ocurre

Cambiar ancho y alto de `settings.json` no altera el ZPL. Se siguen enviando 400 × 200 dots, correspondientes a la plantilla de 50 × 25 mm. La propia pantalla ya advierte esta deuda.

## Por qué ocurre

La API usa `DEFAULT_TEMPLATE` para medir y construir; los ajustes guardados no participan en esa decisión. Hay dos representaciones de la misma configuración, pero solo una dirige el comportamiento.

## Dónde estudiarlo

- [src/app/api/labels/route.ts](../../label-printer-web/src/app/api/labels/route.ts) · línea 71
- [src/app/api/labels/route.ts](../../label-printer-web/src/app/api/labels/route.ts) · línea 105
- [src/lib/labels/label.template.ts](../../label-printer-web/src/lib/labels/label.template.ts) · línea 105
- [src/app/settings/page.tsx](../../label-printer-web/src/app/settings/page.tsx) · línea 274

## Cómo arreglarlo paso a paso

1. Definir una función que construya una plantilla a partir de las medidas.
2. Convertir mm a dots usando la resolución de la impresora.
3. Recalcular márgenes, posiciones, textos y espacio del barcode; cambiar solo `^PW` y `^LL` puede recortar contenido.
4. Usar esa misma plantilla para planificar y emitir ZPL.
5. Rechazar tamaños incompatibles con un mensaje concreto.

## Cómo comprobar la solución

Generar etiquetas con dos tamaños sin enviarlas. Deben cambiar `^PW`/`^LL` y mantenerse todas las zonas dentro de los límites. Probar una etiqueta demasiado estrecha. Solo después probar ambos tamaños físicos con rollos compatibles.

## Qué aprender con este error

Aprender a evitar dos fuentes de verdad y a conectar una opción de interfaz con su efecto real.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E08 - El ancho de Code 128 no coincide con el comando emitido]]
- [[E19 - Los nombres largos pueden superponerse]]

## Corrección

Estado: **corregido-provisional**. Registro: [[Correccion E05 - Medidas de etiqueta]]. Resumen de todas las fichas en [[Registro de correcciones]].
