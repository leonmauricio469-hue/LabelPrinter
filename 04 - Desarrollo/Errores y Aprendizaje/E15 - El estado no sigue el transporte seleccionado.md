---
id: E15
tipo: ficha-aprendizaje
area: impresion
prioridad: P2
estado: pendiente
verificacion: confirmado por lectura del codigo
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E15 - El estado no sigue el transporte seleccionado

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** confirmado por lectura del codigo. **Prioridad:** P2.

## Qué ocurre

Con transporte TCP, el banner sigue consultando una cola local de Windows. Puede describir una impresora USB diferente del destino de red. La prueba de conexión también muestra un mensaje de cola aunque se haya probado un socket.

## Por qué ocurre

El endpoint de estado solo usa `printerName`, sin consultar `printer.transport`. La selección de transporte existe para envío, pero no dirige el diagnóstico ni los mensajes.

## Dónde estudiarlo

- [src/app/api/printer/status/route.ts](../../label-printer-web/src/app/api/printer/status/route.ts) · línea 29
- [src/app/api/printer/status/route.ts](../../label-printer-web/src/app/api/printer/status/route.ts) · línea 39
- [src/app/settings/page.tsx](../../label-printer-web/src/app/settings/page.tsx) · línea 103

## Cómo arreglarlo paso a paso

1. Resolver envío y consulta de estado desde la misma configuración de destino.
2. Para USB, consultar la cola exacta.
3. Para TCP, implementar un diagnóstico compatible o mostrar honestamente “estado físico desconocido” junto al host/puerto.
4. No reemplazar un estado físico por un simple ping o conexión.
5. Adaptar los mensajes de prueba al transporte.

## Cómo comprobar la solución

Cambiar entre TCP y USB con proveedores simulados y comprobar cuál se invoca. En TCP no debe arrancarse PowerShell ni mostrarse el nombre de una cola USB como estado del destino.

## Qué aprender con este error

Aprender contratos de estrategias: elegir una implementación debe cambiar coherentemente todos los comportamientos relacionados.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E07 - Enviado no significa impreso]]
- [[E21 - Estado y envio pueden usar colas diferentes]]
