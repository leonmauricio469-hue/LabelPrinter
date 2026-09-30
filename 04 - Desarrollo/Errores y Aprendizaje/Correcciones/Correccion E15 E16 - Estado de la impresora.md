---
tipo: registro-correccion
fichas: [E15, E16]
fecha: 2026-09-29
estado: corregido
prueba-fisica: pendiente
---
# Corrección de E15 y E16 — estado de la impresora

Fecha: 2026-09-29
Fichas: [[E15 - El estado no sigue el transporte seleccionado]], [[E16 - Las consultas simultaneas no comparten el proceso]]
Commit: `fix(status): follow the selected transport and share status reads`

## Comprensión inicial

- **E15:** `/api/printer/status` siempre consultaba la cola de Windows guardada, aunque el transporte fuera TCP: podía mostrar una cola USB lista mientras las etiquetas iban a otra impresora. "Probar conexión" hablaba siempre de una cola.
- **E16:** la caché solo existía cuando una lectura terminaba; seis consultas durante la primera lanzaban seis `powershell.exe`, y `force` siempre lanzaba otro. En el cliente, un refresco pedido tras imprimir durante otro sondeo se descartaba.

## Antes del cambio

La lógica se extrajo tal cual a módulos puros y se probó:

| Test | Antes |
|---|---|
| 6 consultas simultáneas → 1 lectura (`queue.status.cache.test.ts`) | 6 lecturas |
| 2 consultas forzadas simultáneas → 1 lectura | 2 |
| TCP no lee ninguna cola y nombra `host:puerto` (`printer.status.test.ts`) | leía la cola USB |
| refresco durante un sondeo se ejecuta después (`poll.gate.test.ts`) | se descartaba |
| varios pedidos durante un sondeo → un solo seguimiento | se descartaban |
| "Probar conexión" con TCP no habla de cola (`settings.view.test.ts`) | hablaba de cola |

Los casos que ya funcionaban (resultado fresco reutilizado, caducado releído, forzado tras terminar, USB lee su cola, sondeos sin solaparse) quedaron como guardas.

## Cambio

- `createStatusCache`: una promesa en curso por cola; la comparten todas las consultas, forzadas o no. `force` solo salta un resultado ya terminado.
- `statusForTransport`: USB lee su cola; TCP responde "estado desconocido" con el destino `host:puerto`, porque el puerto 9100 no ofrece estado físico en esta app.
- `createPollGate` en el banner: sin solapes y sin perder el refresco posterior a una impresión.
- `connectionOkMessage`: mensaje de prueba de conexión según el transporte.

## Después del cambio

Todos los tests pasan; suite (71) y typecheck verdes.

## Cierre

- [x] Caso original corregido. - [x] Relacionados funcionan. - [x] Causa explicada. - [x] Evidencia reproducible.

**Pendientes y límites:** con TCP no hay estado físico; si hiciera falta, la Zebra lo informa con `~HS` por el mismo puerto, pero no se implementó sin poder probarlo. **Pendiente de prueba física:** con USB, abrir dos pestañas y comprobar en el Administrador de tareas que se lanza un solo PowerShell por consulta.
