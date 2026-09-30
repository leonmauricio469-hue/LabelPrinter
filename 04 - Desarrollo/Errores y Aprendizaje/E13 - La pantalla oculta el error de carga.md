---
id: E13
tipo: ficha-aprendizaje
area: interfaz
prioridad: P2
estado: pendiente
verificacion: confirmado por flujo de renderizado
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E13 - La pantalla oculta el error de carga

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** confirmado por flujo de renderizado. **Prioridad:** P2.

## Qué ocurre

Cuando falla `/api/settings`, la página guarda un error pero muestra indefinidamente “Cargando configuracion...”. El mensaje útil queda fuera del retorno temprano.

## Por qué ocurre

Se usa `settings === null` para representar tanto carga como fracaso. El componente que muestra errores solo se renderiza después de tener settings: precisamente el dato que no llegó.

## Dónde estudiarlo

- [src/app/settings/page.tsx](../../label-printer-web/src/app/settings/page.tsx) · línea 29
- [src/app/settings/page.tsx](../../label-printer-web/src/app/settings/page.tsx) · línea 114

## Cómo arreglarlo paso a paso

1. Representar carga, éxito y error como estados diferentes.
2. Mostrar el error aunque no haya configuración.
3. Añadir reintento y ayuda para localizar el archivo.
4. Validar la estructura recibida antes de usar sus propiedades.
5. Evitar que un aviso secundario de la lista de impresoras tape el fallo principal.

## Cómo comprobar la solución

Simular HTTP 500, fallo de red y respuesta inválida. La página debe salir de carga, mostrar la causa y permitir reintentar. Una segunda respuesta válida debe abrir el formulario sin recargar toda la aplicación.

## Qué aprender con este error

Aprender a diseñar una máquina de estados de UI. Un booleano o null no siempre alcanza para describir lo que ocurrió.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E12 - Leer settings acepta objetos incompletos]]
