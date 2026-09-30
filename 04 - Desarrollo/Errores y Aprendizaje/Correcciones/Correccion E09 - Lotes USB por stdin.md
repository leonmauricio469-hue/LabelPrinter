---
tipo: registro-correccion
fichas: [E09, M02]
fecha: 2026-09-29
estado: corregido
prueba-fisica: pendiente
---
# Corrección de E09 — los lotes USB excedían el límite de argumentos

Fecha: 2026-09-29
Ficha: [[E09 - Los lotes USB exceden el limite de argumentos]]
Commit: `fix: resolve review findings E01-E06, E08, E09 and E18`

## Comprensión inicial

- **Ocurría:** todo el lote viajaba como argumento `-Base64` al arrancar PowerShell. Windows limita la línea de comandos a 32.767 caracteres; una etiqueta del producto 232 son 4.812 caracteres base64, así que a partir de ~7 etiquetas la impresión USB fallaba.

## Antes del cambio

El armado del comando se extrajo a `src/lib/printing/spooler.invocation.ts`. Test con 999 etiquetas: la línea de comandos medía 4.807.382 caracteres y el payload no iba por stdin.

## Cambio

- El lote se escribe en **stdin** del proceso y se cierra; la línea de comandos tiene tamaño fijo.
- `scripts/send-raw.ps1` lee stdin cuando no recibe `-Base64`. `-Base64` se mantiene para pruebas manuales (`generar-prueba-symbology.ts`).
- Se agregó `npm test` (`node --test` sobre `src/**/*.test.ts`) sin dependencias nuevas, con un hook de resolución mínimo en `test/resolve-ts.mjs`. Esto también avanza [[M02 - Las pruebas no cubren el ciclo completo ni tienen comando unico]].

## Después del cambio

999 etiquetas → línea de comandos bajo el límite; el payload llega entero por stdin.

## Cierre

- [x] Caso original corregido. - [x] Relacionados funcionan. - [x] Causa explicada. - [x] Evidencia reproducible.

**Pendiente de prueba física:** tirada USB de 20 etiquetas o más en Windows. La lectura de stdin en PowerShell 5.1 no se puede verificar desde Linux.
