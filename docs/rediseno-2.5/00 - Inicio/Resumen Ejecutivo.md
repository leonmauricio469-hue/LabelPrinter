# Resumen Ejecutivo (v2.5)

## Que es esta version?

El mismo programa web (**monolito Next.js**) de impresion de etiquetas de **PA PICAR**,
con la interfaz **redisenada por completo** segun las 5 pantallas Stitch y el sistema
**ClearCraft** (modo claro). El motor no se reescribe: ZPL, preview, auditoria,
transporte y checks se reutilizan tal cual.

## Objetivo

```
BUSCAR → PREVISUALIZAR → IMPRIMIR (simple, rapido, lote) → AUDITAR
```

Con todos los botones funcionando de verdad: nada decorativo.

## Componentes Principales

| Componente         | Solucion v2.5                                                        |
| ------------------ | -------------------------------------------------------------------- |
| Aplicacion         | Next.js monolitico (UI + API en un solo proceso), misma base 1.x     |
| Interfaz           | Shell ClearCraft: topbar + tabs + drawer + inspector                  |
| Entrada de datos   | Lector USB (teclado HID) + busqueda manual + CSV para lotes           |
| Impresion          | Zebra **GX420** via ZPL crudo (USB/TCP); **sin hardware: todo virtual** |
| Datos de productos | **Catalogo local (JSON)**; ERP solo si se define endpoint             |
| Plantillas         | Biblioteca multi-plantilla (nuevo en F4); hoy existe 1 sola           |

## Reglas Fundamentales

> **Piel SI, fantasia NO.** Todo numero o estado mostrado sale de datos reales o se marca
> no disponible. Ningun boton decorativo: cada boton existe solo si funciona.

> **Primero las ruedas, despues el carro** (ver [[docs/rediseno-2.5/04 - Desarrollo/Metodologia de la Rueda|Metodologia de la Rueda]]). F0 son las
> fundaciones; cada fase termina con la app funcionando y en verde.

## Estado

| Fase | Estado |
|---|---|
| Plan | Propuesto |
| F0–F6 | No iniciadas |

Ver [[docs/rediseno-2.5/04 - Desarrollo/Estado del Proyecto|Estado del Proyecto]] y [[docs/rediseno-2.5/04 - Desarrollo/Plan de Fases|Plan de Fases]].
