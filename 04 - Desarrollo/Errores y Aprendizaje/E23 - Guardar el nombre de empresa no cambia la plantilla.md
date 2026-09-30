---
id: E23
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
# E23 - Guardar el nombre de empresa no cambia la plantilla

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** confirmado por lectura del codigo. **Prioridad:** P3.

## Qué ocurre

El formulario guarda `businessName` y la API lo pasa al generador, pero ninguna zona actual de la plantilla lo utiliza. El gráfico sigue siendo el logo fijo PA PICAR.

## Por qué ocurre

El tipo LabelData contempla el nombre y el constructor sabe resolverlo, pero la plantilla concreta no tiene una zona con esa fuente. Soporte en el tipo no equivale a funcionalidad visible.

## Dónde estudiarlo

- [src/app/settings/page.tsx](../../label-printer-web/src/app/settings/page.tsx) · línea 263
- [src/lib/labels/label.template.ts](../../label-printer-web/src/lib/labels/label.template.ts) · línea 105
- [src/app/api/labels/route.ts](../../label-printer-web/src/app/api/labels/route.ts)

## Cómo arreglarlo paso a paso

1. Decidir qué significa el ajuste: texto de cabecera, sustitución del logo o ambos.
2. Si se mantiene, añadir una zona visible y reservar su espacio.
3. Si aún no se implementa, ocultar o marcar el campo como futuro.
4. Generar la vista previa y la etiqueta desde la misma plantilla.

## Cómo comprobar la solución

Cambiar PA PICAR por TIENDA DE PRUEBA y comparar el ZPL antes de enviar. El cambio debe afectar una zona visible o la UI debe impedir guardar una opción sin efecto. Comprobar que la nueva zona no tapa el logo.

## Qué aprender con este error

Aprender a rastrear una opción desde formulario hasta el resultado final, y a diseñar ajustes con efectos observables.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E05 - Las dimensiones guardadas no cambian la etiqueta]]

## Corrección

Estado: **corregido**. Registro: [[Correccion E19 E23 - Nombre del producto y de la empresa]]. Resumen de todas las fichas en [[Registro de correcciones]].
