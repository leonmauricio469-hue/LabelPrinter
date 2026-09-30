---
id: E03
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
# E03 - La etiqueta impresa no vuelve al mismo producto

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** reproducido en software. **Prioridad:** P1.

## Qué ocurre

La comprobación de los códigos que se imprimirían encontró 20 productos que no vuelven a su propio producto: 19 sin coincidencia exacta y uno que devuelve el producto 2042 en lugar del 2048. Este total agrupa varias causas; no son 20 errores independientes.

## Por qué ocurre

La generación y la búsqueda transforman el identificador de formas distintas. Seis códigos con dígito de control incorrecto se corrigen al imprimir, pero el catálogo conserva el original y la búsqueda no conoce el alias corregido. El producto 1067 guarda `0400000570608`, imprime `0400000570600` y este último devuelve `none`. Los otros casos incluyen prefijos y el duplicado.

## Dónde estudiarlo

- [src/lib/labels/barcode-plan.ts](../../label-printer-web/src/lib/labels/barcode-plan.ts) · línea 150
- [src/lib/products/product.lookup.ts](../../label-printer-web/src/lib/products/product.lookup.ts)
- [src/app/api/labels/route.ts](../../label-printer-web/src/app/api/labels/route.ts)

## Cómo arreglarlo paso a paso

1. Crear una función pura que resuelva el identificador original y el identificador que se emite.
2. Mantener el dato original para diagnóstico y registrar el alias de impresión sin sobrescribirlo silenciosamente.
3. Indexar ambos identificadores y detectar sus colisiones.
4. Si corresponde corregir el dato de origen, hacerlo con verificación del negocio: cambiar un dígito modifica el identificador.
5. Resolver los casos de E01 y E02 y repetir la comprobación del catálogo completo.

## Cómo comprobar la solución

Para cada producto con código imprimible: obtener el plan, tomar `plan.data`, buscarlo y comprobar que vuelve al mismo código interno o a una ambigüedad explícita. Incluir los productos 735, 1067, 1322, 1378, 1694 y 1843. Después imprimir y escanear una muestra física.

## Qué aprender con este error

Aprender una propiedad de extremo a extremo: generar algo válido no basta si el sistema no puede interpretar su propio resultado.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E01 - Un barcode identifica dos productos]]
- [[E02 - La proteccion de prefijos bloquea identificadores validos]]
- [[E18 - USB y TCP no usan la misma codificacion]]

## Corrección

Estado: **corregido**. Registro: [[Correccion E01 E02 E03 - Resolucion de productos]]. Resumen de todas las fichas en [[Registro de correcciones]].
