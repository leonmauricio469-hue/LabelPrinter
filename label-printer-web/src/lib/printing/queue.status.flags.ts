import type { QueueState } from "./queue.status.types";

/**
 * Mapa de las banderas de estado de la cola de Windows.
 *
 * En un archivo aparte, sin `server-only` y sin hablar con Windows, por dos razones:
 *   1. se puede ejecutar y comprobar sin levantar la app ni lanzar PowerShell;
 *   2. el mapa se puede corregir despues de las pruebas fisicas sin tocar el transporte.
 *
 * La fuente de los valores es el propio enum del sistema,
 * `Microsoft.PowerShell.Cmdletization.GeneratedTypes.Printer.PrinterStatus`, que es un enum
 * de **banderas**: por eso los valores son potencias de dos y pueden venir varias a la vez.
 * Se leyeron del sistema con `[Enum]::GetNames(...)`, no de memoria.
 */

/** Banderas tal y como las devuelve `Get-Printer`. */
export const FLAGS = {
  Paused: 1,
  Error: 2,
  PendingDeletion: 4,
  PaperJam: 8,
  PaperOut: 16,
  ManualFeed: 32,
  PaperProblem: 64,
  Offline: 128,
  IoActive: 256,
  Busy: 512,
  Printing: 1024,
  OutputBinFull: 2048,
  NotAvailable: 4096,
  Waiting: 8192,
  Processing: 16384,
  Initializing: 32768,
  WarmingUp: 65536,
  TonerLow: 131072,
  NoToner: 262144,
  PagePunt: 524288,
  UserIntervention: 1048576,
  OutOfMemory: 2097152,
  DoorOpen: 4194304,
  ServerUnknown: 8388608,
  PowerSave: 16777216,
  ServerOffline: 33554432,
  DriverUpdateNeeded: 67108864,
} as const;

/**
 * Banderas que impiden imprimir.
 *
 * `Paused` esta aqui a proposito: una cola en pausa acepta trabajos y no imprime nada, y el
 * operador veria "1 etiqueta impresa" igual que si la impresora estuviera apagada.
 */
const BLOCKING: Record<number, string> = {
  [FLAGS.Paused]: "cola en pausa",
  [FLAGS.Error]: "error en la impresora",
  [FLAGS.PaperJam]: "atasco de papel",
  [FLAGS.PaperOut]: "sin papel",
  [FLAGS.PaperProblem]: "problema de papel",
  [FLAGS.Offline]: "sin conexion",
  [FLAGS.OutputBinFull]: "bandeja de salida llena",
  [FLAGS.NotAvailable]: "impresora no disponible",
  [FLAGS.UserIntervention]: "requiere intervencion del operador",
  [FLAGS.OutOfMemory]: "memoria insuficiente",
  [FLAGS.DoorOpen]: "tapa abierta",
  [FLAGS.ServerOffline]: "cola sin conexion",
  // En una termica de transferencia es la cinta ( ribbon ), no el tóner.
  [FLAGS.NoToner]: "sin cinta",
};

/** Banderas que avisan pero no impiden imprimir. */
const WARNING: Record<number, string> = {
  [FLAGS.TonerLow]: "cinta baja",
  [FLAGS.PowerSave]: "en ahorro de energia",
  [FLAGS.DriverUpdateNeeded]: "el driver pide actualizacion",
  [FLAGS.PendingDeletion]: "la cola esta marcada para eliminar",
};

/** Actividad normal. No es un problema: la impresora esta trabajando. */
const BUSY_BITS = new Set<number>([
  FLAGS.IoActive,
  FLAGS.Busy,
  FLAGS.Printing,
  FLAGS.Processing,
  FLAGS.Initializing,
  FLAGS.WarmingUp,
  FLAGS.Waiting,
  FLAGS.ManualFeed,
  FLAGS.PagePunt,
]);

/** Banderas que no estan en ninguna tabla: el sistema dijo algo que no sabemos leer. */
const UNMAPPED = new Set<number>([FLAGS.ServerUnknown]);

function collect(flags: number, table: Record<number, string>): string[] {
  return Object.entries(table)
    .filter(([bit]) => (flags & Number(bit)) !== 0)
    .map(([, label]) => label);
}

function hasAny(flags: number, bits: Set<number>): boolean {
  return [...bits].some((bit) => (flags & bit) !== 0);
}

/**
 * Traduce las banderas de Windows a un estado que la UI sepa pintar.
 *
 * El orden importa: `blocked` gana sobre `warning`, y `warning` sobre `busy`. Si la
 * impresora no va a imprimir, da igual que ademas este ocupada, y decirlo al reves seria
 * decirle al operador que todo esta bien.
 *
 * Lo que **no** se puede deducir de aqui: cuanta queda. Windows solo sabe que la impresora
 * reporto "sin papel", no cuantos milímetros. Por eso el estado es "no va a imprimir" y no
 * "quedan 3".
 */
export function interpretQueueStatus(
  flags: number,
  jobCount: number,
): { state: QueueState; message: string } {
  const blocking = collect(flags, BLOCKING);
  if (blocking.length > 0) {
    return { state: "blocked", message: `No va a imprimir: ${blocking.join(", ")}` };
  }

  const warnings = collect(flags, WARNING);
  if (warnings.length > 0) {
    return { state: "warning", message: warnings.join(", ") };
  }

  const cola = jobCount > 0 ? `, ${jobCount} en cola` : "";

  if (hasAny(flags, BUSY_BITS)) {
    return { state: "busy", message: `Ocupada${cola}` };
  }

  if (flags === 0) {
    return { state: "ready", message: `Lista${cola}` };
  }

  if (hasAny(flags, UNMAPPED)) {
    return { state: "unknown", message: "Windows no sabe donde esta el servidor de impresion" };
  }

  // Cualquier otra combinacion: preferimos decir "no lo sé" antes que "lista". Una etiqueta
  // que no sale cuesta papel, tiempo y un producto sin precio puesto.
  return { state: "unknown", message: `Windows reporto banderas sin explicar (${flags})` };
}
