# Impresora Zebra GK420t

## Ficha Tecnica

| Caracteristica | Valor |
|---|---|
| Marca | Zebra |
| Modelo | GK420t |
| Tipo | Impresora termica de etiquetas |
| Lenguaje | ZPL (Zebra Programming Language) |
| Conexiones | USB, Ethernet (opcional) |
| Resolucion | 203 DPI |
| Ancho maximo | 108 mm (4.25 pulgadas) |
| Velocidad | 5 pulgadas por segundo |

## Por que Zebra GK420t?

- Una de las impresoras termicas mas robustas del mercado industrial
- Trabaja de forma nativa con ZPL
- Permite enviar comandos de impresion directa (TCP 9100) sin drivers
- Sin necesidad de drivers complejos
- Impresion instantanea tras cada escaneo

## Comunicacion con la Impresora

> **Estado real en este puesto: la Zebra esta por USB, no por red.** La maquina de la fase
> Rueda no tiene ninguna Zebra en la subred. Se implementaron los dos metodos y el que se
> usa se elige con `transport` en `settings.json`. Ver [[Prueba Fisica Rueda]].

### Metodo 1: TCP/IP raw (el preferible, pero aqui no se pudo)

La impresora se conecta por red (Ethernet) y el servidor Next.js envia ZPL por el puerto
9100. Es el estandar de impresoras termicas y funciona sin drivers.

```ts
// lib/printing/tcp.transport.ts
import net from "node:net";

export interface PrintResult {
  ok: boolean;
  error?: string;
}

export async function sendZpl(host: string, port: number, zpl: string): Promise<PrintResult> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 5000 });

    socket.on("connect", () => {
      socket.write(zpl);
      socket.end();
      resolve({ ok: true });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ ok: false, error: "timeout conectando a la impresora" });
    });

    socket.on("error", (err) => {
      resolve({ ok: false, error: err.message });
    });
  });
}
```

> **Sin probar contra una Zebra real.** En la subred `192.168.2.0/24` no hay ninguna Zebra
> alcanzable, asi que este transporte quedo escrito pero nunca ejercitado con hardware ZPL.
> Cuando la impresora pase a Ethernet hay que probarlo antes de confiar en el.

### Metodo 2: USB via la cola de Windows (el que se usa hoy)

Si la impresora solo esta por USB, se escribe a su cola de Windows. Node no puede hablar con
el spooler directamente, asi que `usb.transport.ts` invoca `scripts/send-raw.ps1`, que hace
P/Invoke a `winspool.drv` (`OpenPrinter` / `StartDocPrinter` / `WritePrinter`).

El detalle que hace que funcione: `pDataType` debe ser **"RAW"**. Sin eso el driver ZPL
reescribe los bytes y la etiqueta sale mal.

```ts
// lib/printing/usb.transport.ts (esqueleto)
import { spawn } from "node:child_process";

export async function sendZplUsb(printerName: string, zpl: string): Promise<PrintResult> {
  // base64 en latin1: el ZPL es texto plano pero el spooler espera bytes
  const base64 = Buffer.from(zpl, "latin1").toString("base64");
  // ... spawn("powershell.exe", [..., "-Printer", printerName, "-Base64", base64])
}
```

Dos cosas que costaron tiempo y conviene no olvidar:

- El nombre de la cola tiene que coincidir **exactamente** con el de Windows. Por eso
  `/settings` ofrece un desplegable con las colas detectadas, y no un campo de texto libre.
- Declarar el P/Invoke con `CharSet.Unicode` lo convierte en `StartDocPrinterW`, que exige
  `DOCINFOW` con `LPWStr`. Pasar un `DOCINFOA` devuelve `Win32 = 1804`.

## Instalacion de Impresora en Windows

**Por USB (como quedo en la fase Rueda):**

1. Conectar la Zebra por USB y esperar a que Windows la reconozca
2. Confirmar la cola exacta: `Get-Printer | Select-Object Name` (o elegirla en `/settings`)
3. En `/settings` poner `transport = usb` y el nombre de la cola
4. "Probar conexion" y despues imprimir una etiqueta

**Por Ethernet (cuando se pueda):**

1. Conectar la Zebra al switch y configurar IP fija
2. Verificar la IP: imprimir la config de red desde los botones de la impresora
3. En `/settings` poner `transport = tcp`, host e IP y puerto 9100

## Ver tambien

- [[ZPL Lenguaje Impresion]]
- [[Prueba Fisica Rueda]]
- [[Dimensiones Etiqueta]]
- [[Zebra GK420t Specs]]
