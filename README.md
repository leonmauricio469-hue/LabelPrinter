# LabelPrinter

Aplicación local para buscar productos, diseñar etiquetas y enviar trabajos a una impresora Zebra. El código, el catálogo, las plantillas y la documentación del rediseño 2.5 están consolidados en este repositorio. La versión del paquete sigue siendo `1.2.0`; «2.5» identifica la línea de rediseño.

## Desarrollar

El lanzador prepara Node.js 24 LTS y npm 11 dentro de `.tools/`, sin permisos de administrador. Las versiones están fijadas en `.node-version` y `packageManager`.

```powershell
.\desarrollo.ps1 setup
.\desarrollo.ps1 dev
```

Abre `http://127.0.0.1:3000`. Los comandos `dev` y `start` escuchan en la interfaz local. Detén el servidor con `Ctrl+C`.

## Verificar y ejecutar

```powershell
.\desarrollo.ps1 verify
.\desarrollo.ps1 start
```

`setup` descarga Node desde su publicación oficial, comprueba SHA-256 e instala las dependencias con `npm ci`. `verify` ejecuta el chequeo de tipos, las 11 comprobaciones del catálogo y las etiquetas, y la compilación de producción. La aplicación usa fuentes descargadas por `next/font`; una compilación inicial necesita conexión a Internet.

Si ya tienes Node 24 y npm 11 en el sistema, los comandos `npm ci`, `npm run dev`, `npm run verify` y `npm start` también funcionan desde `label-printer-web/`.

## Ubicaciones

| Contenido | Ruta |
| --- | --- |
| Aplicación Next.js | `label-printer-web/` |
| Catálogo, plantillas, historial y configuración | `label-printer-web/data/` |
| Documentación del rediseño 2.5 | [docs/rediseno-2.5](docs/rediseno-2.5/README.md) |
| Requisitos y antecedentes originales | `00 - Inicio/` a `05 - Referencias/` |
| Tareas y evidencia de implementación | `odd/tasks/` |
| Plantilla de reuniones recuperada | `Templates/template-reunion.md` |

Los datos reales de `data/` se conservan. Las cachés de compilación, los archivos temporales, el registro local de habilidades y los complementos instalados de Obsidian no forman parte del código fuente. Las credenciales y los archivos `.env` quedan fuera de Git.

## Versión consolidada

La consolidación del 10 de octubre de 2026 integra `feat/ajustes-diseno-funcional` con `feat/busqueda-autocomplete-quitar-ajuste`: ajustes recientes, búsqueda predictiva, mantenimiento de impresora y mejoras del envío USB y por lotes.

El código activo en esta máquina vive en `C:\Users\admin\LabelPrinter`. Las copias de OneDrive y de la documentación 2.5 se integraron o se conservaron en respaldos comprimidos verificados. Las ramas históricas se preservan en Git.

La comprobación de software no acredita una impresión física. Avanzar, calibrar, imprimir una prueba o imprimir un lote puede consumir etiquetas; esas pruebas de hardware quedan pendientes.
