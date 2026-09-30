# Patrones de Diseno

## Arquitectura en capas (dentro del monolitico)

```
Presentacion (UI / pages)
   -> Aplicacion (route handlers / server actions)
   -> Dominio (types + logica pura: templates, builders)
   -> Infraestructura (repositorios y transports)
```

Regla: las capas interiores no conocen a las exteriores. El dominio no importa de Next.js ni de la impresora.

## Patrones usados

### 1. Modular monolith
Cada modulo (products, labels, printing, settings, audit) vive en una carpeta autocontenida en `lib/`. El acoplamiento entre modulos se hace por contrato (types), nunca por importacion cruzada directa de infraestructura.

### 2. Repository (Productos)
```
product.repository.ts             -> interfaz (contrato)
product.catalog.repository.ts     -> implementacion sobre el catalogo local (hoy)
xetux.repository.ts               -> implementacion real XETUX (en suspenso, futura)
```
Un factory decide cual usar segun config. Si XETUX vuelve, entra sin tocar la UI ni el flujo de impresion.

### 3. Strategy / Transport (Impresoras)
```
printer.transport.ts  -> interfaz: send(zpl): Promise<PrintResult>
usb.transport.ts      -> cola de Windows vía send-raw.ps1 (EN USO: la Zebra esta por USB)
tcp.transport.ts      -> socket raw puerto 9100 (escrito, nunca probado con hardware ZPL)
```

El reparto de responsabilidades es el que hace que sea barato anadir un tercer metodo: si
alguna vez la impresora se pone en red, o si se imprime a un PDF, es una implementacion mas
de la misma interfaz y un caso mas en el factory.

### 4. DTO + Validacion (zod)
Cada route handler valida su input con un schema zod. Input invalido -> 400 tipado, nunca llega al dominio.

### 5. Builder / Template de ZPL
`label.template.ts` define el diseno visual (zonas, posiciones). `zpl.builder.ts` convierte el template + datos en string ZPL. Plantilla separada del generador.

### 6. Use case de impresion
Un unico punto `printLabel(product, qty)` que: valida -> busca producto -> genera ZPL -> transporta -> audita. Nada imprime fuera de este flujo.

### 7. Config externa
Toda config (impresora, dimensiones, empresa) sale de `settings.json` leido en el boot. No hay constantes esparcidas en el codigo.

## Anti-patrones a evitar

- Llamar al repository (o a XETUX cuando vuelva) directamente desde componentes
- ZPL en linea dentro de la UI
- Duplicar el schema de producto (un solo `product.types.ts` como fuente)
- Guardar estado en la UI que deberia estar en settings
- Editar el catalogo directamente desde la UI en modo produccion

## Ver tambien

- [[Estructura de Carpetas]]
- [[Convenciones de Codigo]]
- [[Modulos del Programa]]