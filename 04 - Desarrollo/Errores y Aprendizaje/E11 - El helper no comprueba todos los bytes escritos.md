---
id: E11
tipo: ficha-aprendizaje
area: impresion
prioridad: P2
estado: corregido
verificacion: riesgo identificado en codigo
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E11 - El helper no comprueba todos los bytes escritos

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** riesgo identificado en codigo. **Prioridad:** P2.

## Qué ocurre

El helper acepta éxito cuando `WritePrinter` devuelve verdadero sin comprobar que `$written` sea igual a `$bytes.Length`. La revisión no reprodujo una escritura parcial con la impresora.

## Por qué ocurre

El contrato comunica dos datos: si la llamada tuvo éxito y cuántos bytes se escribieron. El programa solo usa el primero. Un envío completo debe justificar también el conteo.

## Dónde estudiarlo

- [scripts/send-raw.ps1](../../label-printer-web/scripts/send-raw.ps1) · línea 131
- [scripts/send-raw.ps1](../../label-printer-web/scripts/send-raw.ps1) · línea 144

## Cómo arreglarlo paso a paso

1. Comprobar la cantidad escrita.
2. Si el contrato y el modo permiten continuar, escribir desde el desplazamiento restante hasta completar.
3. Ante cero progreso o error, detenerse y reportar el estado incierto del trabajo.
4. Revisar cómo cancelar un trabajo incompleto y cómo comunicarlo sin fomentar reintentos duplicados.
5. No afirmar que agrupar N bloques garantiza que salen todos o ninguno en papel.

## Cómo comprobar la solución

Simular 100 bytes solicitados y 60 escritos; el resultado no debe ser un éxito completo. Probar continuación de los 40 restantes, cero progreso y fallo. En Windows verificar los bytes e ID reales con una pequeña tirada.

## Qué aprender con este error

Aprender a distinguir éxito de una llamada y cumplimiento de toda la operación. Una API puede devolver una medida que también hay que verificar.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E09 - Los lotes USB exceden el limite de argumentos]]
- [[E22 - Un timeout puede causar etiquetas duplicadas]]

## Fuentes

[Microsoft: WritePrinter y pcWritten](https://learn.microsoft.com/en-us/windows/win32/printdocs/writeprinter).

## Corrección

Estado: **corregido**. Registro: [[Correccion E10 E11 - Puente nativo del spooler]]. Resumen de todas las fichas en [[Registro de correcciones]].
