---
id: E12
tipo: ficha-aprendizaje
area: configuracion
prioridad: P2
estado: corregido
verificacion: reproducido en copia temporal
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E12 - Leer settings acepta objetos incompletos

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** reproducido en copia temporal. **Prioridad:** P2.

## Qué ocurre

Una configuración con solo `printer.transport` y `label.widthMm` se acepta aunque falten `printerName` y `businessName`. Una edición manual o un archivo de una versión anterior puede romper consumidores.

## Por qué ocurre

`as AppSettings` es una promesa al compilador, no validación en ejecución. `{...defaults, ...parsed}` mezcla solo el nivel superior: la sección printer del JSON reemplaza la sección completa, incluidos sus defaults.

## Dónde estudiarlo

- [src/lib/settings/settings.store.ts](../../label-printer-web/src/lib/settings/settings.store.ts) · línea 23
- [src/lib/validation/schemas.ts](../../label-printer-web/src/lib/validation/schemas.ts) · línea 39

## Cómo arreglarlo paso a paso

1. Leer JSON como `unknown` y mantener el tratamiento del BOM.
2. Definir qué defaults pueden completar una versión anterior sin ocultar datos inválidos.
3. Completar cada sección y validar el resultado con el schema.
4. Distinguir archivo inexistente, JSON inválido y estructura inválida.
5. Devolver un diagnóstico recuperable en las rutas que consumen settings.

## Cómo comprobar la solución

En un directorio temporal probar archivo inexistente, BOM, JSON cortado, puerto inválido y objeto parcial. Verificar que los campos obligatorios nunca lleguen undefined a la UI y que un valor inválido no sea sustituido silenciosamente.

## Qué aprender con este error

Aprender la diferencia entre tipos de TypeScript y validación de datos externos, además de mezclas superficiales y profundas.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E13 - La pantalla oculta el error de carga]]
- [[E17 - Guardar settings puede dejar el archivo incompleto]]

## Corrección

Estado: **corregido**. Registro: [[Correccion E12 E17 - Configuracion segura]]. Resumen de todas las fichas en [[Registro de correcciones]].
