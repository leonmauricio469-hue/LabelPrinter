---
id: E25
tipo: ficha-aprendizaje
area: diagnostico
prioridad: P3
estado: pendiente
verificacion: confirmado por codigo y revision del catalogo
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E25 - El aviso de EAN incorrecto no describe lo que se imprime

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** confirmado por codigo y revision del catalogo. **Prioridad:** P3.

## Qué ocurre

El repositorio advierte que ninguna etiqueta de ciertos EAN incorrectos será legible, pero el plan de impresión corrige su dígito de control. La advertencia considera solo la forma de 13 dígitos y no incluye todos los UPC-A de 12 que también se corrigen. La revisión encontró seis correcciones en el plan.

## Por qué ocurre

El diagnóstico aplica una regla antigua separada del plan actual. Las reglas duplicadas evolucionaron por caminos diferentes y ahora comunican una consecuencia que no coincide con la ejecución.

## Dónde estudiarlo

- [src/lib/products/product.catalog.repository.ts](../../label-printer-web/src/lib/products/product.catalog.repository.ts)
- [src/lib/labels/barcode-plan.ts](../../label-printer-web/src/lib/labels/barcode-plan.ts) · línea 150
- [scripts/check-ean.ts](../../label-printer-web/scripts/check-ean.ts)

## Cómo arreglarlo paso a paso

1. Calcular advertencias desde el mismo plan usado al imprimir.
2. Distinguir código original inválido, corrección propuesta y código sin espacio imprimible.
3. Avisar del identificador que cambia sin prometer que será reconocido por el sistema de origen.
4. Mantener el registro del dato original para corregirlo de manera consciente.

## Cómo comprobar la solución

Comparar los avisos del catálogo con los seis casos de E03. Cada mensaje debe coincidir con el plan y no declarar ilegible un resultado solo por una regla obsoleta. Probar un dato realmente no imprimible y otro correcto.

## Qué aprender con este error

Aprender que los mensajes también son parte del contrato del programa: una advertencia obsoleta puede llevar al usuario a una decisión equivocada.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E03 - La etiqueta impresa no vuelve al mismo producto]]
