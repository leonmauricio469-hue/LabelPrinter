---
id: E07
tipo: ficha-aprendizaje
area: impresion
prioridad: P2
estado: corregido
verificacion: confirmado por lectura del codigo
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E07 - Enviado no significa impreso

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** confirmado por lectura del codigo. **Prioridad:** P2.

## Qué ocurre

La interfaz dice “impresa” tras aceptar el envío, aunque la cola pueda esperar por papel. TCP incluso resuelve éxito inmediatamente después de llamar `socket.write()`. La revisión no confirmó papel impreso.

## Por qué ocurre

El programa combina tres hechos: aceptar una solicitud, entregar bytes y producir una etiqueta física. Son etapas diferentes. Un socket conectado o un trabajo aceptado por Windows no demuestra que el mecanismo de impresión haya terminado.

## Dónde estudiarlo

- [src/lib/printing/tcp.transport.ts](../../label-printer-web/src/lib/printing/tcp.transport.ts) · línea 11
- [src/components/use-print.ts](../../label-printer-web/src/components/use-print.ts)
- [src/lib/audit/audit.store.ts](../../label-printer-web/src/lib/audit/audit.store.ts)

## Cómo arreglarlo paso a paso

1. En TCP esperar la finalización o callback de escritura y manejar cierre, error y timeout.
2. Nombrar el éxito que realmente se conoce: “enviado a la cola” o “datos enviados”.
3. Modelar estados solicitado, enviando, aceptado, desconocido y fallido; usar “impreso” solo con evidencia suficiente.
4. Registrar por separado el ID de auditoría y el ID del spooler.
5. Verificar si el driver proporciona un estado físico fiable antes de prometerlo.

## Cómo comprobar la solución

Simular una conexión seguida de error de escritura: no debe devolver éxito temprano. En Windows, enviar un único trabajo con la cola pausada: la UI debe indicar aceptación pendiente, no papel impreso. Reanudar y observar sin inferir más de lo que informa el driver.

## Qué aprender con este error

Aprender a describir con precisión el estado de una operación asíncrona. Un mensaje optimista puede provocar reintentos y duplicados.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E10 - La firma nativa de StartDocPrinter es incorrecta]]
- [[E22 - Un timeout puede causar etiquetas duplicadas]]

## Corrección

Estado: **corregido**. Registro: [[Correccion E07 - Enviado no es impreso]]. Resumen de todas las fichas en [[Registro de correcciones]].
