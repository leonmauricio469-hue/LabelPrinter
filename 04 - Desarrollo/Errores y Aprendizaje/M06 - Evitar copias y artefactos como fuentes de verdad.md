---
id: M06
tipo: ficha-aprendizaje
area: mantenimiento
prioridad: P3
estado: pendiente
verificacion: limpieza realizada - prevencion pendiente
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# M06 - Evitar copias y artefactos como fuentes de verdad

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** limpieza realizada - prevencion pendiente. **Prioridad:** P3.

## Qué ocurre

La copia antigua y artefactos de compilación podían confundirse con la versión actual. La limpieza autorizada eliminó esa copia, `.preview-build`, logs, CSV temporal y backup del catálogo de prueba. La app actual quedó en `LabelPrinter/label-printer-web/`.

## Por qué ocurre

Los archivos fuente, los datos activos y los resultados generados se distribuían juntos sin una separación clara. Un compilado viejo puede ejecutarse aunque su fuente haya cambiado.

## Dónde estudiarlo

- [.gitignore](../../label-printer-web/.gitignore)
- [tsconfig.preview.json](../../label-printer-web/tsconfig.preview.json)

## Cómo arreglarlo paso a paso

1. Documentar una única ruta de app y cómo regenerar resultados.
2. Ignorar logs, temporales y compilados cuando se configure Git.
3. Mantener los datos activos y las copias recuperables con una finalidad explícita.
4. No borrar archivos solo por parecer sobrantes: primero identificar quién los usa.
5. Si se vuelve a generar `.preview-build`, correr pruebas que partan de fuentes actualizadas.

## Cómo comprobar la solución

Un proyecto limpio debe regenerar sus artefactos siguiendo instrucciones, sin depender de la copia vieja. No hace falta repetir la limpieza para demostrarlo. Confirmar que permanecen catálogo, settings, historial y fuentes.

## Qué aprender con este error

Aprender diferencia entre fuente, dato y artefacto generado; la organización evita errores antes de que aparezcan.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[M02 - Las pruebas no cubren el ciclo completo ni tienen comando unico]]
- [[M03 - Preparar control de versiones para aprender]]
