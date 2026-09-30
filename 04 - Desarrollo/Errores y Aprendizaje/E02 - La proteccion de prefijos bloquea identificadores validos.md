---
id: E02
tipo: ficha-aprendizaje
area: productos
prioridad: P1
estado: corregido
verificacion: reproducido en software
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E02 - La proteccion de prefijos bloquea identificadores validos

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** reproducido en software. **Prioridad:** P1.

## Qué ocurre

285 códigos internos no se aceptan como coincidencia exacta. Ejemplos: `1`, `2`, `3` y `438`. También se rechazan barcodes completos como `202616` porque son prefijos de otros barcodes. Buscar por nombre y seleccionar puede seguir funcionando.

## Por qué ocurre

Antes de buscar una coincidencia completa, `resolveQuery()` descarta cualquier texto que pudiera ser un barcode cortado. Un prefijo puede ser tanto una lectura incompleta como un identificador completo legítimo. El mismo endpoint recibe escaneos y búsquedas manuales, pero no conoce la intención.

## Dónde estudiarlo

- [src/lib/products/product.lookup.ts](../../label-printer-web/src/lib/products/product.lookup.ts) · línea 120
- [src/lib/products/product.catalog.repository.ts](../../label-printer-web/src/lib/products/product.catalog.repository.ts) · línea 140
- [src/app/fast/page.tsx](../../label-printer-web/src/app/fast/page.tsx)

## Cómo arreglarlo paso a paso

1. Definir dos intenciones: búsqueda manual por código interno y búsqueda por barcode escaneado.
2. Para código interno, resolver ese campo exactamente.
3. Para escaneo, comprobar los barcodes completos y sus duplicados; si un identificador completo también parece una lectura parcial, definir una política de confirmación.
4. No sustituir esa política por una longitud mínima: existen 151 barcodes numéricos de 4 a 6 dígitos.
5. Mantener las coincidencias parciales fuera de la impresión automática.

## Cómo comprobar la solución

Probar `438` como código manual y como escaneo, el barcode completo `4388`, `202616` y un prefijo inexistente. El código manual debe ser accesible; un resultado ambiguo de escaneo debe pedir confirmación. Recorrer todos los códigos internos y registrar qué resultados ya son exactos.

## Qué aprender con este error

Una regla defensiva puede producir falsos positivos. La intención y el contexto deben formar parte del contrato, no inferirse únicamente del número de caracteres.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E01 - Un barcode identifica dos productos]]
- [[E24 - La busqueda oculta que faltan resultados]]

## Corrección

Estado: **corregido**. Registro: [[Correccion E01 E02 E03 - Resolucion de productos]]. Resumen de todas las fichas en [[Registro de correcciones]].
