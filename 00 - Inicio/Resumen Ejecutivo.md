# Resumen Ejecutivo

## Que es este proyecto?

Un programa web (**monolito Next.js**) que automatiza la generacion e impresion de etiquetas de productos para el negocio **PA PICAR**. Los datos de productos salen de un **catalogo local** de la app. La integracion con **XETUX / POSADMIN** esta **temporalmente suspendida**.

## Objetivo

Que el operador pueda:

```
ESCANEAR CODIGO → IMPRIMIR ETIQUETA → SIGUIENTE
```

Sin tener que navegar manualmente por el sistema para cada producto.

## Componentes Principales

| Componente         | Solucion                                                |
| ------------------ | ------------------------------------------------------- |
| Aplicacion         | Next.js monolitico (UI + API en un solo proceso)        |
| Interfaz           | Web en el navegador del puesto                          |
| Entrada de datos   | Lector USB de codigos de barras (funciona como teclado) |
| Impresion          | Zebra GK420t via ZPL crudo; **hoy por USB**             |
| Datos de productos | **Catalogo local (JSON)**; XETUX en suspenso            |

## Regla Fundamental

> Esta app es un cliente de impresion con su propio catalogo local. No es un sistema de inventario. XETUX queda fuera de alcance temporalmente; si vuelve, se integrara detras del mismo contrato de productos sin tocar la UI.

## Estado

| Fase | Estado |
|---|---|
| Rueda (MVP minimo) | **Completada** — etiqueta fisica impresa y verificada, 50 x 25 mm |
| Patineta (escaneo) | **Codigo listo**, falta la prueba con el escaner USB fisico y cargar el catalogo real |
| Carro (producto completo) | No iniciada |

> La Zebra resulto estar conectada por **USB**, no por Ethernet, asi que el transporte real es
> el de la cola de Windows. El de TCP 9100 quedo escrito pero sin probar. Ver
> [[Prueba Fisica Rueda]].

Ver [[Proximos Pasos]] y [[Estado del Proyecto]].