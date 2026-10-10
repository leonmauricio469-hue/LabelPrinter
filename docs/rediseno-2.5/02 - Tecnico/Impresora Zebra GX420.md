# Impresora Zebra GX420

Correccion registrada: la impresora del proyecto es una **Zebra GX420**, no "GK420t".
Los docs y comentarios viejos que dicen "GK420t" estan pendientes de barrido (cuidando
los wikilinks de este vault).

## Datos firmes

| Item | Valor |
|---|---|
| Modelo | Zebra GX420 (corregido; antes figuraba GK420t) |
| Resolucion | **203 DPI** = 8 dots/mm |
| Cola Windows | `ZDesigner GX420t`, puerto `USB002` |
| Transporte real | **USB** (spooler Windows, ZPL crudo). TCP 9100 escrito pero sin probar |
| Etiqueta | **59 x 35 mm** = 472 x 280 dots, horizontal, sin escalado de driver |
| Hardware fisico | **No hay**. Toda prueba es virtual (`npm run check` + render PNG) |

> GX420t y GK420t son ambos 203 DPI: la correccion es de nomenclatura, **no cambia
> ningun calculo** de geometria.

## Alcance de soporte

**Exclusivo GX420.** Otros modelos y marcas quedan pospuestos hasta nuevo aviso por
decision del usuario. La pantalla de Dispositivos no lista, activa ni vincula otras
impresoras: una sola impresora, su estado real y su configuracion.

## Ojo con las maquetas

Stitch dibuja una **Zebra ZD620 a 300 DPI** con etiquetas de 100x150 mm. Todo eso se
**adapta a la GX420/203 DPI/59x35** al implementar: la piel se respeta, las cifras se
recalculan.
