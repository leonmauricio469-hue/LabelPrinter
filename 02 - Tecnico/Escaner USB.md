# Escaner USB

## Contexto

El lector de codigo de barras se conecta al PC via USB y funciona como un **dispositivo tipo teclado** (HID).

## Como Funciona

```
ESCANEAR SOBRE CODIGO
        │
        ▼
7591234567890 + ENTER
        │
        ▼
El PC recibe los caracteres como si fueran escritos por teclado
        │
        ▼
La web app captura el codigo (keydown en el navegador)
```

## Como se identifico en este PC

El lector aparece en Windows como un **dispositivo compuesto USB**:

```
USB\VID_2258&PID_2348\0329        ("Dispositivo compuesto USB", descripcion del bus: "USB Keyboard")
  +- MI_00   Dispositivo de teclado HID   clase Keyboard   driver kbdhid
  +- MI_01   HID definido por el proveedor (interfaz de configuracion)
```

- Estado `OK`, en `Port_#0002.Hub_#0004`.
- Que MI_00 sea clase `Keyboard` con el driver `kbdhid` confirma que **esta en modo teclado**:
  el sistema lo trata como un teclado mas y no hace falta ningun driver.
- El VID `2258` es de fabricante chino de escaneres; el PID cambia entre modelos.

Para comprobarlo en cualquier PC:

```powershell
Get-PnpDevice | Where-Object { $_.InstanceId -like 'USB\VID_2258*' -or $_.InstanceId -like 'HID\VID_2258*' }
Get-CimInstance Win32_Keyboard | Select-Object Name, DeviceID, Status
```

## Confirmaciones Pendientes

- [x] El escaner esta conectado por USB? -- si, `VID_2258&PID_2348`
- [x] Funciona como teclado (HID)? -- si, clase `Keyboard`, driver `kbdhid`
- [x] Envia Enter despues del codigo? -- si: `scanner-input.tsx` no perdio ni un caracter y
      el operador leyo la etiqueta con el mismo escaner que la imprimio
- [x] Que formato de codigo usa? -- EAN-13 (13 digitos), que es lo que guarda el catalogo
- [ ] Que longitud tiene el codigo tipicamente? -- pendiente con el catalogo real de PA PICAR

> **El hardware ya no es la duda.** El ciclo completo se verifico el 2026-09-29: el
> operador escaneo desde `/fast`, salio la etiqueta y la leyo con el mismo escaner.
>
> Lo que **si** hubo que arreglar fue del lado de la etiqueta: el barcode impreso salia por
> debajo del minimo de ISO/IEC 15420 y no lo leia nadie. Ver [[Prueba Legibilidad Barcode]].

## Prueba Rapida

Para confirmar que funciona como teclado:

1. Abrir **Bloc de Notas**
2. Escanear un codigo de barras sobre el Bloc
3. Verificar que aparece el codigo escrito
4. Verificar que se presiona Enter (salta de linea)

Si esto funciona, la web app puede capturar el input directamente con un listener de teclado en el documento.

### Version mejorada: la pagina `/teclado`

Cuando el escaner "no escanea", casi siempre es una de tres cosas: que la ventana del
navegador no tiene el foco, que el escaner no manda Enter, o que manda un caracter de
control antes del codigo. Las tres se ven de un vistazo en `http://localhost:3000/teclado`,
que registra cada `keydown` que llega al navegador:

| Indicador | Que dice |
|---|---|
| `EVENTOS` | Si queda en 0, no llega nada: la ventana no tiene el foco |
| `VENTANA CON FOCO` | `SI` / `NO` |
| `ELEMENTO ACTIVO` | Que esta enfocado; si es un `INPUT`, el listener global lo ignora a proposito |
| `BUFFER` | El codigo reconstruido, caracter a caracter |
| `ULTIMO SUFIJO` | Con que tecla cerro el escaneo |

La tabla da el detalle por tecla: `key`, `code`, modificadores, destino del evento y los
milisegundos entre tecla y tecla (un escaner lento supera el timeout de 500 ms y el codigo
se parte).

**No imprime nada ni toca el catalogo**: es solo un monitor de teclado.

> Ojo con un detalle del diagnostico: en este PC el escaner resulto estar **bien**, pero el
> barcode de la etiqueta salia por debajo del minimo del estandar. Son dos fallos que se
> ven igual desde fuera ("no escanea") y que hay que separar antes de tocar nada.

## Implementacion en la web app (ya hecha)

Esta nota propone un esqueleto; la version real esta en `components/scanner-input.tsx` y
corrige dos problemas del esqueleto.

### 1. El buffer va en un ref, no en el estado

El esqueleto tiene el buffer en `useState` y registra el listener con `[buffer, onScan]` en
las dependencias, asi que **el listener se vuelve a registrar en cada tecla** y captura un
buffer viejo. Con un escaner real, que teclea a toda velocidad, eso pierde caracteres: el
codigo llega incompleto y no existe en el catalogo.

La version real guarda el buffer en un `useRef` y el callback en otro `useRef`, de modo que
el listener se registra una sola vez:

```tsx
const bufferRef = useRef("");
const onScanRef = useRef(onScan);
useEffect(() => { onScanRef.current = onScan; });   // sin dependencias a proposito

useEffect(() => {
  if (!enabled) return;
  function handleKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === "Enter") {
      const code = bufferRef.current.trim();
      bufferRef.current = "";
      if (code) onScanRef.current(code);
      return;
    }
    if (e.key.length !== 1) return;
    bufferRef.current += e.key;
  }
  document.addEventListener("keydown", handleKey);
  return () => document.removeEventListener("keydown", handleKey);
}, [enabled]);   // solo cambia si se activa o desactiva
```

### 2. No secuestrar el teclado si el operador esta escribiendo

El listener esta en `document`, asi que tambien pilla lo que el operador teclee a mano en
el campo de busqueda. Si no se filtra, cada tecla manual se trataria como un escaneo.

La version real ignora el evento cuando el foco esta en un `INPUT`, `TEXTAREA`, `SELECT` o
un elemento editable, y ademas ignora los atajos con Ctrl/Alt/Meta. Asi el escaner se
comporta como un teclado normal dentro del campo, y el Enter lo maneja el propio formulario.

### Otros detalles que quedaron

- **Timeout de 500 ms** entre teclas: descarta tecleos lentos y codigos partidos.
- **`enabled`**: en `/fast` la captura esta siempre activa; en el modo normal se desactiva
  mientras hay una impresion en curso, para no encolar escaneos sin querer.
- **Cola en modo rapido**: si llega un escaneo mientras el anterior sigue yendo al spooler,
  se apila en vez de descartarse. Perder una etiqueta sin aviso es peor que unos ms de
  espera.

## Ver tambien

- [[Flujo Principal]]
- [[Prueba Patineta]]
- [[Prueba Legibilidad Barcode]]
- [[Arquitectura General]]
