# Editor de Plantillas

## Descripcion

Funcionalidad futura que permitira modificar el diseno de las etiquetas sin cambiar el codigo fuente.

## Campos Configurables

| Campo | Ejemplo |
|---|---|
| Logo | Logo de PA PICAR |
| Nombre del producto | CAFE AMANECER 500GR |
| Codigo de barras | 7591234567890 |
| Referencia | REF-001 |
| Precio | $7.80 |
| Texto libre | Texto adicional |
| Tamano de fuente | 12pt, 14pt, etc. |
| Posicion X,Y | Coordenadas en la etiqueta |
| Tipografia | Arial, Courier, etc. |
| Dimensiones de etiqueta | Ancho x Alto en mm |

## Ejemplo de Plantilla

```
┌─────────────────────────────┐
│           LOGO              │
│                             │
│ {{PRODUCTO}}                │
│                             │
│ {{CODIGO_BARRAS}}           │
│                             │
│ REF {{REFERENCIA}}          │
│                       {{PRECIO}}
└─────────────────────────────┘
```

## Prioridad

- **Funcionalidad futura**
- No es parte del MVP
- Se implementa cuando el flujo principal este validado

## Ver tambien

- [[Plantilla Etiqueta]]
- [[ZPL Lenguaje Impresion]]
