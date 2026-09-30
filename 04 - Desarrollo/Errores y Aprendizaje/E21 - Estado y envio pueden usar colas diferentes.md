---
id: E21
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
# E21 - Estado y envio pueden usar colas diferentes

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** confirmado por lectura del codigo. **Prioridad:** P2.

## Qué ocurre

El diagnóstico puede encontrar una cola por coincidencia aproximada y decir que existe, pero el envío intenta abrir exactamente el nombre configurado. La impresora “lista” puede ser otra o el envío puede fallar por nombre inexistente.

## Por qué ocurre

El modo Status usa un fallback `*nombre*` y toma la primera coincidencia. `OpenPrinter` recibe el nombre original. El helper devuelve información de dos mecanismos de resolución diferentes.

## Dónde estudiarlo

- [scripts/send-raw.ps1](../../label-printer-web/scripts/send-raw.ps1) · línea 25
- [scripts/send-raw.ps1](../../label-printer-web/scripts/send-raw.ps1) · línea 99
- [scripts/send-raw.ps1](../../label-printer-web/scripts/send-raw.ps1) · línea 111

## Cómo arreglarlo paso a paso

1. Resolver la cola exacta una sola vez.
2. Si no existe, indicar `missing`; no elegir automáticamente una cola parecida.
3. Usar sugerencias aproximadas solo para que el usuario seleccione y guarde un nombre completo.
4. Aplicar el mismo contrato en Check, Status y Send.

## Cómo comprobar la solución

Configurar `ZDesigner` cuando existen dos colas que contienen ese texto. El resultado debe exigir una selección o indicar nombre inexistente, nunca escoger la primera. Probar después el nombre completo y confirmar que estado y envío lo usan.

## Qué aprender con este error

Aprender a mantener identidad consistente entre diagnóstico y acción. Un estado solo ayuda si describe el mismo destino.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E14 - El campo manual de impresora queda inaccesible]]
- [[E15 - El estado no sigue el transporte seleccionado]]
