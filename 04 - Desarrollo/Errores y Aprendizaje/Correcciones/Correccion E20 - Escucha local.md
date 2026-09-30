---
tipo: registro-correccion
fichas: [E20]
fecha: 2026-09-29
estado: corregido
prueba-fisica: pendiente
---
# Corrección de E20 — la app podía escuchar fuera del puesto local

Fecha: 2026-09-29
Ficha: [[E20 - La app puede escuchar fuera del puesto local]]
Commit: `fix(startup): listen only on 127.0.0.1`

## Comprensión inicial

- **Ocurría:** `npm run dev` y `npm run start` llamaban `next dev` / `next start` sin `-H`. Según la documentación de Next.js (consultada para la versión en uso), ambos escuchan por defecto en `0.0.0.0`. `HOST=127.0.0.1` en `.env.example` no lo leía nadie. Las rutas de imprimir y de configuración no tienen autenticación.

## Antes del cambio

`src/lib/startup.contract.test.ts` (test de contrato sobre `package.json`): `dev` y `start` debían incluir `-H 127.0.0.1`. Fallaron los dos.

## Cambio

- `"dev": "next dev -H 127.0.0.1"`, `"start": "next start -H 127.0.0.1"`.
- `.env.example` **no se modificó**: los archivos `.env*` están protegidos por los permisos del entorno de trabajo. Sigue teniendo `HOST=127.0.0.1`, que no lo lee nadie. Pendiente manual: quitar esa línea y dejar un comentario que diga que la escucha local la fija `-H 127.0.0.1` en `package.json`.

## Después del cambio

2/2 en verde.

## Cierre

- [x] Caso original corregido. - [x] Causa explicada. - [x] Evidencia reproducible.

**Pendientes y límites:** si algún día se necesita acceso desde otro equipo, primero hay que agregar autenticación. **Pendiente de prueba física:** en el puesto, `netstat -an | findstr 3000` debe mostrar `127.0.0.1:3000`, no `0.0.0.0:3000`. El servicio de Windows que arranque la app debe usar `npm run start`.
