/**
 * Comprobacion del mapa de banderas de la cola de Windows.
 *
 * Ejecutar:  node .preview-build\scripts\check-queue-status.js
 *
 * No habla con la impresora: solo comprueba la tabla de decision. Sirve para dos cosas:
 *   1. que ninguna bandera del enum quede sin decidir (eso seria un "desconocido" que en
 *      produccion se lee como averia);
 *   2. que las combinaciones se resuelvan en el orden correcto, que es donde un mapa de
 *      banderas se equivoca facil.
 */
import { FLAGS, interpretQueueStatus } from "../src/lib/printing/queue.status.flags";

let fallos = 0;

function check(nombre: string, ok: boolean, detalle = "") {
  if (ok) {
    console.log(`  ok    ${nombre}`);
  } else {
    fallos++;
    console.log(`  FALLA ${nombre}${detalle ? ` -> ${detalle}` : ""}`);
  }
}

console.log("### 1. Sin banderas: lista");
{
  const r = interpretQueueStatus(0, 0);
  check("flags=0 da ready", r.state === "ready", r.state);
  check("el mensaje dice Lista", r.message === "Lista", r.message);
}

console.log("\n### 2. Sin banderas pero con trabajos esperando");
{
  const r = interpretQueueStatus(0, 3);
  check("sigue siendo ready", r.state === "ready", r.state);
  check("menciona la cola", r.message.includes("3 en cola"), r.message);
}

console.log("\n### 3. Cada bandera bloqueante, sola");
const bloqueantes: Array<[string, number, string]> = [
  ["cola en pausa", FLAGS.Paused, "pausa"],
  ["error en la impresora", FLAGS.Error, "error"],
  ["atasco de papel", FLAGS.PaperJam, "atasco"],
  ["sin papel", FLAGS.PaperOut, "papel"],
  ["problema de papel", FLAGS.PaperProblem, "problema de papel"],
  ["sin conexion", FLAGS.Offline, "conexion"],
  ["bandeja de salida llena", FLAGS.OutputBinFull, "bandeja"],
  ["impresora no disponible", FLAGS.NotAvailable, "no disponible"],
  ["requiere intervencion del operador", FLAGS.UserIntervention, "intervencion"],
  ["memoria insuficiente", FLAGS.OutOfMemory, "memoria"],
  ["tapa abierta", FLAGS.DoorOpen, "tapa"],
  ["cola sin conexion", FLAGS.ServerOffline, "cola sin conexion"],
  ["sin cinta", FLAGS.NoToner, "cinta"],
];
for (const [esperado, flag, trozo] of bloqueantes) {
  const r = interpretQueueStatus(flag, 0);
  check(
    `${esperado} -> blocked`,
    r.state === "blocked" && r.message.includes(trozo),
    `${r.state} / ${r.message}`,
  );
}

console.log("\n### 4. Cada bandera de aviso, sola");
const avisos: Array<[string, number, string]> = [
  ["cinta baja", FLAGS.TonerLow, "cinta baja"],
  ["en ahorro de energia", FLAGS.PowerSave, "ahorro"],
  ["el driver pide actualizacion", FLAGS.DriverUpdateNeeded, "driver"],
  ["la cola esta marcada para eliminar", FLAGS.PendingDeletion, "eliminar"],
];
for (const [esperado, flag, trozo] of avisos) {
  const r = interpretQueueStatus(flag, 0);
  check(
    `${esperado} -> warning`,
    r.state === "warning" && r.message.includes(trozo),
    `${r.state} / ${r.message}`,
  );
}

console.log("\n### 5. Cada bandera de actividad, sola (no es un problema)");
const actividad: Array<[string, number]> = [
  ["IoActive", FLAGS.IoActive],
  ["Busy", FLAGS.Busy],
  ["Printing", FLAGS.Printing],
  ["Processing", FLAGS.Processing],
  ["Initializing", FLAGS.Initializing],
  ["WarmingUp", FLAGS.WarmingUp],
  ["Waiting", FLAGS.Waiting],
  ["ManualFeed", FLAGS.ManualFeed],
  ["PagePunt", FLAGS.PagePunt],
];
for (const [nombre, flag] of actividad) {
  const r = interpretQueueStatus(flag, 0);
  check(`${nombre} -> busy`, r.state === "busy", `${r.state} / ${r.message}`);
}

console.log("\n### 6. Orden de precedencia");
{
  // Bloquear gana sobre actividad: si no va a imprimir, "ocupada" seria mentira.
  const r = interpretQueueStatus(FLAGS.PaperOut | FLAGS.Printing, 0);
  check("papel + imprimiendo -> blocked", r.state === "blocked", r.state);
  check("el motivo es el papel", r.message.includes("papel"), r.message);
}
{
  // Aviso gana sobre actividad.
  const r = interpretQueueStatus(FLAGS.TonerLow | FLAGS.Printing, 0);
  check("cinta baja + imprimiendo -> warning", r.state === "warning", r.state);
}
{
  // Bloquear gana sobre aviso.
  const r = interpretQueueStatus(FLAGS.PaperOut | FLAGS.TonerLow, 0);
  check("papel + cinta baja -> blocked", r.state === "blocked", r.state);
}
{
  const r = interpretQueueStatus(FLAGS.ServerUnknown, 0);
  check("ServerUnknown -> unknown", r.state === "unknown", r.state);
}
{
  // Actividad + trabajos pendientes: los dos datos son utiles.
  const r = interpretQueueStatus(FLAGS.Printing, 2);
  check("imprimiendo con 2 en cola", r.state === "busy" && r.message.includes("2 en cola"), r.message);
}

console.log("\n### 7. Ninguna bandera del enum queda sin decidir");
{
  const decididas = new Set<number>([
    // Las cuatro tablas del modulo, mas ServerUnknown.
    FLAGS.Paused, FLAGS.Error, FLAGS.PendingDeletion, FLAGS.PaperJam, FLAGS.PaperOut,
    FLAGS.ManualFeed, FLAGS.PaperProblem, FLAGS.Offline, FLAGS.IoActive, FLAGS.Busy,
    FLAGS.Printing, FLAGS.OutputBinFull, FLAGS.NotAvailable, FLAGS.Waiting,
    FLAGS.Processing, FLAGS.Initializing, FLAGS.WarmingUp, FLAGS.TonerLow,
    FLAGS.NoToner, FLAGS.PagePunt, FLAGS.UserIntervention, FLAGS.OutOfMemory,
    FLAGS.DoorOpen, FLAGS.ServerUnknown, FLAGS.PowerSave, FLAGS.ServerOffline,
    FLAGS.DriverUpdateNeeded,
  ]);
  const sinDecidir = Object.entries(FLAGS).filter(([, v]) => !decididas.has(v));
  check(
    "todas las banderas estan en alguna tabla",
    sinDecidir.length === 0,
    sinDecidir.map(([k, v]) => `${k}=${v}`).join(", "),
  );

  // Y ninguna produce un "desconocido" inesperado al ir sola.
  const insolitas = Object.entries(FLAGS).filter(([nombre, v]) => {
    if (nombre === "ServerUnknown") return false;
    return interpretQueueStatus(v, 0).state === "unknown";
  });
  check(
    "ninguna bandera aislada cae en unknown",
    insolitas.length === 0,
    insolitas.map(([k, v]) => `${k}=${v}`).join(", "),
  );
}

console.log(
  fallos === 0
    ? "\nTodo correcto."
    : `\n${fallos} comprobacion(es) fallida(s).`,
);
process.exit(fallos === 0 ? 0 : 1);
