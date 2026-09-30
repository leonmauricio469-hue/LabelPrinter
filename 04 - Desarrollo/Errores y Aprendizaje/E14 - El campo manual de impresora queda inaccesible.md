---
id: E14
tipo: ficha-aprendizaje
area: interfaz
prioridad: P2
estado: pendiente
verificacion: confirmado por lectura del codigo
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E14 - El campo manual de impresora queda inaccesible

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** confirmado por lectura del codigo. **Prioridad:** P2.

## Qué ocurre

Si falla la lista de impresoras, la UI recomienda escribir el nombre a mano. Sin embargo, sigue mostrando un select con el nombre guardado y normalmente no ofrece ningún campo editable.

## Por qué ocurre

`queueOptions` añade siempre el valor actual a la lista. Aunque `printers` esté vacío, la lista derivada no lo está. La condición que permite mostrar el input casi nunca se cumple en una configuración válida.

## Dónde estudiarlo

- [src/app/settings/page.tsx](../../label-printer-web/src/app/settings/page.tsx) · línea 119
- [src/app/settings/page.tsx](../../label-printer-web/src/app/settings/page.tsx) · línea 156

## Cómo arreglarlo paso a paso

1. Guardar por separado el estado de la enumeración: cargando, lista o error.
2. Ofrecer una opción “Otra cola” y un campo manual visible.
3. Conservar el valor actual sin convertirlo en la única opción posible.
4. Validar el nombre al probar conexión y mostrar exactamente qué cola se abrirá.

## Cómo comprobar la solución

Simular lista vacía, enumeración fallida y nombre guardado que no aparece en Windows. En todos los casos debe ser posible escribir un nuevo nombre y probarlo. La selección de una cola existente también debe seguir funcionando.

## Qué aprender con este error

Aprender que una lista derivada puede ocultar el estado original del que dependía una decisión de interfaz.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E21 - Estado y envio pueden usar colas diferentes]]
