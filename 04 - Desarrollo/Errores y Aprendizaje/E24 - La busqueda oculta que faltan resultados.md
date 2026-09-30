---
id: E24
tipo: ficha-aprendizaje
area: interfaz
prioridad: P3
estado: corregido
verificacion: confirmado por lectura del codigo
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E24 - La busqueda oculta que faltan resultados

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** confirmado por lectura del codigo. **Prioridad:** P3.

## Qué ocurre

La búsqueda parcial se corta a 60 productos. La UI cuenta la lista recibida y puede decir que hay 60 coincidencias aunque existan más, sin indicar que faltan resultados.

## Por qué ocurre

La respuesta contiene elementos pero no el total ni una bandera `truncated`. La presentación usa longitud del resultado como si representara todos los datos.

## Dónde estudiarlo

- [src/lib/products/product.lookup.ts](../../label-printer-web/src/lib/products/product.lookup.ts)
- [src/app/page.tsx](../../label-printer-web/src/app/page.tsx)

## Cómo arreglarlo paso a paso

1. Devolver `total` y `truncated` junto a los elementos.
2. Para aprender, mostrar “60 de N; escribe más para refinar” antes de añadir paginación.
3. Mantener selección explícita para cualquier coincidencia parcial.
4. Si se pagina, definir orden estable para evitar saltos o repetidos.

## Cómo comprobar la solución

Crear 61 productos con una palabra común. La UI debe comunicar que el resultado está limitado. Probar además 0, 1 y 60 coincidencias; un único resultado parcial tampoco debe activar impresión automática.

## Qué aprender con este error

Aprender contratos de paginación y diferencia entre tamaño de página y tamaño del conjunto.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E02 - La proteccion de prefijos bloquea identificadores validos]]

## Corrección

Estado: **corregido**. Registro: [[Correccion E24 - Busqueda truncada]]. Resumen de todas las fichas en [[Registro de correcciones]].
