---
id: M04
tipo: ficha-aprendizaje
area: documentacion
prioridad: P2
estado: pendiente
verificacion: contradicciones documentales confirmadas
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# M04 - Mantener la documentacion sincronizada

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** contradicciones documentales confirmadas. **Prioridad:** P2.

## Qué ocurre

Algunas notas dicen que el catálogo real no existe o que solo hay 12 productos; el archivo actual contiene 3.080. Otras describen rechazos 422 que ahora se han convertido en avisos. También se afirma que un único trabajo garantiza impresión física atómica, lo que no se ha demostrado.

## Por qué ocurre

Las decisiones y resultados se escribieron por fase, pero no se marcó qué partes eran históricas y cuáles describen el código actual. Una documentación anterior puede llevar a reparar o probar el comportamiento equivocado.

## Dónde estudiarlo

- [[Estado del Proyecto]]
- [[Proximos Pasos]]
- [[Inicio]]

## Cómo arreglarlo paso a paso

1. Usar [[Mapa de errores y aprendizaje]] como registro actual de hallazgos.
2. Mantener las notas de pruebas anteriores como historia con fecha y alcance.
3. Al cerrar una ficha, actualizar contrato API, roadmap y decisión relevante.
4. Separar “verificado en software” de “probado en puesto real”.
5. Documentar que un lote en un job no garantiza todos-o-ninguno sobre el papel.

## Cómo comprobar la solución

Comparar catálogo, endpoints y estado de las fichas. Cada afirmación de prueba debe tener datos usados, fecha y alcance. Un lector nuevo debe poder localizar la app actual sin recurrir a la copia eliminada.

## Qué aprender con este error

Aprender documentación como parte del sistema: una afirmación técnica necesita contexto y evidencia.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[M05 - Verificar el resultado con hardware real]]
