---
id: E22
tipo: ficha-aprendizaje
area: concurrencia
prioridad: P2
estado: pendiente
verificacion: riesgo identificado en flujo de envio
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E22 - Un timeout puede causar etiquetas duplicadas

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** riesgo identificado en flujo de envio. **Prioridad:** P2.

## Qué ocurre

Si pasan 15 segundos se mata PowerShell y se informa fallo. El trabajo puede haber sido aceptado antes. También puede perderse la respuesta HTTP después del envío. Si el operador reintenta, puede obtener dos etiquetas.

## Por qué ocurre

El timeout mide cuánto espera el programa, no si la impresora recibió algo. Falla la confirmación, pero el efecto externo quizá ya ocurrió. No existe un ID estable de solicitud que permita reconocer un reintento.

## Dónde estudiarlo

- [src/lib/printing/usb.transport.ts](../../label-printer-web/src/lib/printing/usb.transport.ts) · línea 52
- [src/components/use-print.ts](../../label-printer-web/src/components/use-print.ts)
- [src/app/api/labels/route.ts](../../label-printer-web/src/app/api/labels/route.ts)

## Cómo arreglarlo paso a paso

1. Crear un ID de solicitud antes de enviar y conservarlo en los reintentos.
2. Registrar recibido, enviando, aceptado, fallido o incierto.
3. Deduplicar IDs ya aceptados; para inciertos, mostrar un diagnóstico y exigir decisión consciente.
4. Aprovechar el ID real de spooler cuando se pueda consultar.
5. No prometer “exactamente una vez” si no se puede confirmar el efecto físico.

## Cómo comprobar la solución

Simular aceptación del trabajo y pérdida de respuesta. Repetir el mismo ID no debe enviar otro trabajo automáticamente. Probar una solicitud nueva, un fallo previo al envío y una caída durante el envío. Cada resultado debe describir lo que se sabe.

## Qué aprender con este error

Aprender idempotencia y resultados inciertos. Un reintento no es inocuo cuando la operación consume papel o cambia el mundo exterior.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E07 - Enviado no significa impreso]]
- [[E10 - La firma nativa de StartDocPrinter es incorrecta]]
- [[M01 - El historial no permite reconstruir la etiqueta]]
