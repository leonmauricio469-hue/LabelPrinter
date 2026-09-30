---
tipo: registro-correccion
fichas: [E04]
fecha: 2026-09-29
estado: corregido
prueba-fisica: pendiente
---
# Corrección de E04 — los escaneos pendientes se sobrescribían

Fecha: 2026-09-29
Ficha: [[E04 - Los escaneos pendientes se sobrescriben]]
Commit: `fix: resolve review findings E01-E06, E08, E09 and E18`

## Comprensión inicial

- **Esperado:** cada escaneo en `/fast` imprime una etiqueta, aunque llegue mientras otra se envía (~2,4 s por USB).
- **Ocurría:** `pendingRef` guardaba un solo código. Con A imprimiendo, B pendiente y luego C, C reemplazaba a B sin aviso.
- **Por qué:** una variable no es una cola.

## Antes del cambio

La lógica se extrajo primero sin cambiar comportamiento a `src/lib/scanning/scan.queue.ts`. Test: empujar A (bloqueado), B y C. Resultado: `["A", "C"]`. Un segundo test mostró que un error del spooler escapaba como rechazo sin manejar.

## Cambio

Cola FIFO: `createScanQueue(process)` encola y procesa uno a la vez; un fallo se registra y no detiene los siguientes. `fast/page.tsx` solo hace `queue.push(code)`; la cola se crea una vez y llama siempre a la última versión del manejador.

Alternativa considerada: rechazar visiblemente el escaneo mientras se imprime. Se prefirió no perder etiquetas.

## Después del cambio

`npm test`: se imprimen A, B y C en orden; con A fallando, B se imprime.

## Cierre

- [x] Caso original corregido. - [x] Relacionados funcionan. - [x] Causa explicada. - [x] `npm test`.

**Pendiente de prueba física:** escanear tres productos seguidos durante una impresión USB real.
