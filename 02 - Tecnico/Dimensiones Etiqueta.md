# Dimensiones de Etiqueta

## Estado Actual

> **PENDIENTE**: Las dimensiones exactas deben medirse con regla sobre la etiqueta fisica real.

## Que medir

| Medida | Descripcion |
|---|---|
| Ancho | De borde a borde horizontal |
| Alto | De borde a borde vertical |
| Margen izquierdo | Distancia al contenido |
| Margen superior | Distancia al contenido |

## Medidas Tipicas de Etiquetas

| Tipo | Ancho x Alto |
|---|---|
| Etiqueta de estanteria pequena | 38mm x 25mm |
| Etiqueta de estanteria mediana | 50mm x 30mm |
| Etiqueta de estanteria grande | 75mm x 50mm |
| Etiqueta de precio | 58mm x 40mm |

## Conversion a Dots (Zebra GK420t)

La GK420t tiene resolucion de **203 DPI** = 8 dots por mm.

| Medida (mm) | Dots |
|---|---|
| 38 mm | 304 dots |
| 40 mm | 320 dots |
| 50 mm | 400 dots |
| 58 mm | 464 dots |
| 75 mm | 600 dots |
| 25 mm | 200 dots |
| 30 mm | 240 dots |
| 40 mm | 320 dots |
| 50 mm | 400 dots |

## Ejemplo de Medida

Si la etiqueta mide **50mm x 30mm**:

```zpl
^PW400    ; 50mm x 8 dots/mm = 400 dots
^LL240    ; 30mm x 8 dots/mm = 240 dots
```

## Proximos pasos

1. [ ] Medir etiqueta fisica con regla
2. [ ] Anotar ancho x alto en mm
3. [ ] Convertir a dots
4. [ ] Actualizar plantilla ZPL

## Ver tambien

- [[ZPL Lenguaje Impresion]]
- [[Plantilla Etiqueta]]
- [[Impresora Zebra GK420t]]
