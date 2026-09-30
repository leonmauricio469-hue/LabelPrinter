# Cantidad de Etiquetas

## Descripcion

El operador debe poder indicar cuantas etiquetas imprimir para cada producto.

## Ejemplo

```
Producto:
CAFE AMANECER 500GR

Precio:
$7.80

Cantidad:
[ 20 ]

         [IMPRIMIR]

Resultado:
20 etiquetas iguales
```

## Comportamiento

| Modo | Cantidad Default |
|---|---|
| Modo normal | Campo editable (default 1) |
| Modo continuo | Fijo en 1 |

## Casos de uso

- **1 etiqueta**: Producto individual para estanteria
- **5-10 etiquetas**: Producto que se exhibe en varios lugares
- **20-50 etiquetas**: Producto nuevo que se distribuye en toda la tienda

## Implementacion

- Campo numerico con spinner (flechas +/-)
- Tambien permite escribir directamente el numero
- Minimo: 1
- Maximo: 999 (razonable para una session)

## Ver tambien

- [[Modo Continuo]]
- [[Interfaz de Usuario]]
