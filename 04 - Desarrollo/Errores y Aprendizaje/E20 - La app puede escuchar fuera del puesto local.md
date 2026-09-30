---
id: E20
tipo: ficha-aprendizaje
area: ejecucion
prioridad: P2
estado: corregido
verificacion: configuracion y contrato verificados
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E20 - La app puede escuchar fuera del puesto local

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** configuracion y contrato verificados. **Prioridad:** P2.

## Qué ocurre

Los scripts arrancan Next sin hostname explícito, cuyo valor predeterminado es `0.0.0.0`. Las rutas permiten imprimir y cambiar ajustes sin autenticación. Un equipo que alcance el puerto podría usarlas; no se verificó exposición real ni el firewall.

## Por qué ocurre

El ejemplo contiene `HOST=127.0.0.1`, pero esa variable no se usa en el código ni se pasa a la CLI. Guardar una variable no demuestra que el proceso la lea. Escuchar en todas las interfaces no implica necesariamente que el firewall permita acceso.

## Dónde estudiarlo

- [package.json](../../label-printer-web/package.json)
- [.env.example](../../label-printer-web/.env.example)
- [src/app/api/settings/route.ts](../../label-printer-web/src/app/api/settings/route.ts)
- [src/app/api/labels/route.ts](../../label-printer-web/src/app/api/labels/route.ts)

## Cómo arreglarlo paso a paso

1. Para un único puesto, añadir explícitamente `-H 127.0.0.1` a dev y start.
2. Comprobar la dirección de escucha del proceso.
3. Si se desea acceso desde otros equipos, definir esa necesidad y añadir controles de acceso y protección de mutaciones.
4. Mantener el caso local sencillo: no añadir un sistema de usuarios complejo solo para aprender este ajuste.

## Cómo comprobar la solución

Iniciar el servidor y observar su dirección de escucha. Para modo local, debe aceptar localhost y no ofrecer ese servicio por la dirección LAN. La prueba requiere un entorno Next instalado; no se hizo en la revisión anterior.

## Qué aprender con este error

Aprender configuración efectiva frente a configuración aparente, interfaces de red y límites de acceso.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[M03 - Preparar control de versiones para aprender]]

## Fuentes

[Next.js: hostname de dev y start](https://nextjs.org/docs/app/api-reference/cli/next).

## Corrección

Estado: **corregido**. Registro: [[Correccion E20 - Escucha local]]. Resumen de todas las fichas en [[Registro de correcciones]].
