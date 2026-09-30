# XETUX / POSADMIN - Informacion

> **EN SUSPENSO**: XETUX esta temporalmente fuera de alcance. La app usa un catalogo local. Esta nota se conserva como referencia.

## Sistema

| Dato | Valor |
|---|---|
| Nombre | XETUX |
| Interfaz | POSADMIN |
| Version | v1.27.66 |
| Tipo | Aplicacion web |
| Navegador | Google Chrome |

## Modulo Utilizado Actualmente

- **Generar Etiquetas** → **Codigo de Barras**

## Campos en POSADMIN

| Campo | Descripcion |
|---|---|
| Codigo de barras | Identificador del producto |
| Descripcion | Nombre del producto |
| Numero de lote | Lote del producto |
| Cantidad | Unidades |
| Precio | Precio unitario |

## Funcionamiento

1. Usuario va al modulo "Codigo de Barras"
2. Ingresa/agrega productos
3. Presiona "Generar Etiquetas"
4. El sistema imprime las etiquetas

## Como accedemos a los datos

XETUX es una web app, por lo que su **API REST interna** en el navegador es la forma de obtener datos. Ver [[API XETUX POSADMIN]].

## Ver tambien

- [[API XETUX POSADMIN]]
- [[Flujo Principal]]
- [[Arquitectura General]]
