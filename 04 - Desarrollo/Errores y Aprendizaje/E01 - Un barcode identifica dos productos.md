---
id: E01
tipo: ficha-aprendizaje
area: productos
prioridad: P1
estado: pendiente
verificacion: reproducido en software
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E01 - Un barcode identifica dos productos

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** reproducido en software. **Prioridad:** P1.

## Qué ocurre

El barcode `7509546074627` pertenece a los productos 2042 (PALMOLIVE JABON HIDRATACION RADIANTE, $2,55) y 2048 (PALMOLIVE SENSACION HUMECTANTE, $3,60). Al escanearlo se elige el 2042 incluso si la etiqueta provenía del 2048. El modo rápido puede imprimir el precio equivocado.

## Por qué ocurre

El catálogo tiene un dato duplicado y el repositorio usa `.find()`, que devuelve solo la primera fila. Después, la API llama “exacta” a esa selección. Coincidir con el texto completo no significa identificar un único producto: falta comprobar la unicidad.

## Dónde estudiarlo

- [src/lib/products/product.catalog.repository.ts](../../label-printer-web/src/lib/products/product.catalog.repository.ts) · línea 115
- [src/lib/products/product.lookup.ts](../../label-printer-web/src/lib/products/product.lookup.ts) · línea 122
- [data/catalog.json](../../label-printer-web/data/catalog.json)

## Cómo arreglarlo paso a paso

1. Detectar duplicados después de normalizar los barcodes y mostrar todas las filas afectadas.
2. Verificar el dato con el negocio; no inventar un barcode para resolverlo.
3. Si la duplicidad es válida, devolver un resultado `ambiguous` con los candidatos.
4. En modo normal pedir selección; en modo rápido detener ese escaneo y avisar.
5. Imprimir usando el código interno único del producto elegido.

## Cómo comprobar la solución

Crear dos productos de prueba con el mismo barcode y precios diferentes. Buscar ese barcode debe devolver ambigüedad y `/fast` no debe enviar ningún trabajo. Elegir el segundo en modo normal debe generar su precio. Confirmar que invertir el orden del catálogo no cambia el resultado de negocio.

## Qué aprender con este error

Un identificador necesita un contrato de unicidad. Aprender a separar coincidencia textual, integridad de datos y decisión del usuario.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E02 - La proteccion de prefijos bloquea identificadores validos]]
- [[E03 - La etiqueta impresa no vuelve al mismo producto]]
