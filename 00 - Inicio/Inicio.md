---
tipo: indice
area: proyecto
---
# LabelPrinter PA PICAR - Inicio

> Generador automatizado de etiquetas con catalogo local (XETUX en suspenso)

## Navegacion

### General
- [[Resumen Ejecutivo]]
- [[Estado del Proyecto]]
- [[Proximos Pasos]]

### Requisitos
- [[Objetivo del Proyecto]]
- [[Flujo Principal]]
- [[Modo Continuo]]
- [[Cantidad de Etiquetas]]
- [[Busqueda Manual]]
- [[Editor Plantillas]]

### Tecnico
- [[Arquitectura General]]
- [[API XETUX POSADMIN]] *(en suspenso)*
- [[Impresora Zebra GK420t]]
- [[Escaner USB]]
- [[ZPL Lenguaje Impresion]]
- [[Dimensiones Etiqueta]]

### Diseno
- [[Plantilla Etiqueta]]
- [[Interfaz de Usuario]]

### Desarrollo
- [[Stack Tecnologico]]
- [[Estructura de Carpetas]]
- [[Patrones de Diseno]]
- [[Convenciones de Codigo]]
- [[Modulos del Programa]]

### Referencias
- [[XETUX POSADMIN Info]] *(en suspenso)*
- [[Zebra GK420t Specs]]

### Templates
- [[template-reunion]]

---

## Estado Actual del Proyecto

| Fase | Estado |
|---|---|
| Requisitos | Completado |
| Stack (Next.js monolitico) | Redefinido |
| Rueda - imprimir primera etiqueta | No iniciada |
| Patineta - escanear e imprimir | No iniciada |
| Carro - producto completo | No iniciada |
| XETUX | En suspenso (temporal) |

## Proxima Accion Inmediata

1. Crear la app Next.js (base + Tailwind)
2. Implementar `tcp.transport.ts` y `zpl.builder.ts`
3. Imprimir la primera etiqueta de prueba a la Zebra
