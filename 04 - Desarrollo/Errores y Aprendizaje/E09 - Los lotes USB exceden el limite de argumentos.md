---
id: E09
tipo: ficha-aprendizaje
area: impresion
prioridad: P1
estado: pendiente
verificacion: tamaño medido y contrato oficial
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E09 - Los lotes USB exceden el limite de argumentos

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** tamaño medido y contrato oficial. **Prioridad:** P1.

## Qué ocurre

La API admite hasta 999 copias, pero el envío USB coloca todo el ZPL en un argumento base64 de PowerShell. Con el producto 232, diez copias generan 48.096 caracteres base64; Windows permite 32.767 caracteres para la línea completa. Siete ya superan ese límite en este ejemplo.

## Por qué ocurre

`buildZplBatch()` repite texto y logo por copia. Base64 añade aproximadamente un tercio al tamaño: diez etiquetas no son solo “el número 10”, sino diez gráficos completos transportados por un canal limitado.

## Dónde estudiarlo

- [src/lib/printing/usb.transport.ts](../../label-printer-web/src/lib/printing/usb.transport.ts) · línea 37
- [src/lib/printing/usb.transport.ts](../../label-printer-web/src/lib/printing/usb.transport.ts) · línea 97
- [src/lib/labels/zpl.builder.ts](../../label-printer-web/src/lib/labels/zpl.builder.ts) · línea 152

## Cómo arreglarlo paso a paso

1. Pasar el payload por stdin o un archivo temporal, dejando en argumentos solo información pequeña.
2. Manejar error, timeout y limpieza de ese canal.
3. Evaluar `^PQ` para repetir una etiqueta sin duplicar el gráfico; confirmar su conteo real.
4. Mantener el límite de cantidad en la API y decidir un tamaño de trabajo razonable.
5. No resolverlo reduciendo la cantidad máxima a un número accidental dependiente del logo.

## Cómo comprobar la solución

Medir bytes ZPL y caracteres base64 para 1, 6, 7, 10 y 999 copias sin imprimir. Con el canal nuevo, verificar que los argumentos ya no crecen con el lote y que todos los bytes llegan al helper. La prueba física final debe empezar con pocas copias y contar el resultado.

## Qué aprender con este error

Aprender límites de sistemas operativos, coste de codificaciones y elección del canal de comunicación entre procesos.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E11 - El helper no comprueba todos los bytes escritos]]

## Fuentes

[Microsoft: límite de CreateProcessW](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw).
