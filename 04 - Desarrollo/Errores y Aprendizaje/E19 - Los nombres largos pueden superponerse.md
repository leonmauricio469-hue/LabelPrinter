---
id: E19
tipo: ficha-aprendizaje
area: etiquetas
prioridad: P2
estado: corregido
verificacion: contrato y catalogo verificados - papel pendiente
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E19 - Los nombres largos pueden superponerse

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** contrato y catalogo verificados - papel pendiente. **Prioridad:** P2.

## Qué ocurre

La plantilla con barcode permite una línea de 240 dots. Hay 1.049 nombres de más de 30 caracteres, con máximo 50. Es una señal de riesgo: no demuestra que todos desborden, porque la fuente es proporcional. Zebra indica que el exceso de líneas en `^FB` se superpone en la última.

## Por qué ocurre

Se limita a una línea sin definir una política para nombres que ocupan más ancho. Contar caracteres es solo una aproximación; depende de fuente, ancho, palabras y caracteres. La zona del barcode empieza en y=96, de modo que añadir líneas sin mover nada crea otro solapamiento.

## Dónde estudiarlo

- [src/lib/labels/label.template.ts](../../label-printer-web/src/lib/labels/label.template.ts) · línea 116
- [src/lib/labels/zpl.builder.ts](../../label-printer-web/src/lib/labels/zpl.builder.ts) · línea 122

## Cómo arreglarlo paso a paso

1. Elegir varios nombres difíciles del catálogo, no solo el más largo.
2. Diseñar un área de nombre con altura y ancho suficientes.
3. Ajustar fuente, envolver líneas o abreviar de forma explícita; mantener legible la identificación.
4. Reubicar precio y barcode si cambia la altura.
5. Probar también la plantilla alternativa sin barcode.

## Cómo comprobar la solución

Generar ejemplos cortos, largos, con palabras anchas y con acentos. Revisar todas las zonas y luego imprimir una muestra; no aprobarla únicamente por el número de caracteres. Registrar foto, medidas y si se puede identificar el producto.

## Qué aprender con este error

Aprender restricciones de diseño y diferencias entre una vista previa y el motor de texto del dispositivo.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E05 - Las dimensiones guardadas no cambian la etiqueta]]
- [[E18 - USB y TCP no usan la misma codificacion]]

## Fuentes

[Zebra: ^FB y exceso de líneas](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-fb.html).

## Corrección

Estado: **corregido**. Registro: [[Correccion E19 E23 - Nombre del producto y de la empresa]]. Resumen de todas las fichas en [[Registro de correcciones]].
