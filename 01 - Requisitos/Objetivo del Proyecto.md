# Objetivo del Proyecto

## Meta Principal

Desarrollar un programa para PC/Windows que automatice completamente la generacion e impresion de etiquetas de productos, utilizando como fuente de datos un **catalogo local** de la app. La integracion con **XETUX / POSADMIN** esta temporalmente suspendida.

## Que NO es este proyecto

- NO es un sistema de inventario
- NO es una base de datos paralela compartida
- NO depende de XETUX (temporalmente fuera de alcance)

## Que SI es

Un **cliente de impresion** con catalogo local que genera etiquetas de forma automatica.

## Flujo Objetivo

```
LECTOR DE CODIGO DE BARRAS
        │
        ▼
  CODIGO DEL PRODUCTO
        │
        ▼
  BUSCAR EN CATALOGO LOCAL
        │
   ┌────┴────┐
   │         │
Existe    No existe
   │         │
   ▼         ▼
Datos     Avisar error
producto
   │
   ▼
GENERAR ETIQUETA
   │
   ▼
IMPRESION DIRECTA
   │
   ▼
SIGUIENTE PRODUCTO
```

## Criterios de Exito

- [ ] Escanear producto y obtener datos automaticamente
- [ ] Imprimir etiqueta directamente sin PDF
- [ ] Modo continuo: escanear-imprimir-siguiente
- [ ] Cantidad configurable de etiquetas
- [ ] Catalogo local editable como unica fuente de datos

## Ver tambien

- [[Flujo Principal]]
- [[Modo Continuo]]
- [[Resumen Ejecutivo]]
