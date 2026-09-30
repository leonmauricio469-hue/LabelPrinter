/**
 * Tipos del estado de la cola de impresora.
 *
 * En un archivo aparte, sin `server-only`, porque los necesitan tanto el modulo de servidor
 * (`queue.status.ts`) como los componentes de cliente. Mismo motivo que
 * `product.types.ts`: los contratos de dominio se pueden tipar en la UI.
 */

export type QueueState =
  /** Normal, sin nada pendiente. */
  | "ready"
  /** Imprimiendo o calentandose. No es un problema. */
  | "busy"
  /** Algo no anda bien, pero sigue imprimiendo (cinta baja, ahorro de energia). */
  | "warning"
  /** No va a imprimir hasta que alguien intervenga. */
  | "blocked"
  /** La cola de Windows no existe con ese nombre. */
  | "missing"
  /** No se pudo averiguar, o Windows devolvio banderas que no se conocen. */
  | "unknown";

export interface QueueStatus {
  state: QueueState;
  /** Mensaje corto para el operador, en espanol. */
  message: string;
  /** Trabajos esperando en la cola. */
  jobCount: number;
  /** Momento de la consulta, ISO. */
  checkedAt: string;
  /**
   * Datos crudos de Windows.
   *
   * Se exponen a proposito: no esta verificado que el driver de la Zebra rellene todas las
   * banderas, asi que hace falta poder mirar el numero sin abrir una consola de PowerShell
   * durante las pruebas fisicas.
   */
  raw: {
    queue: string;
    found: boolean;
    /** `PrinterStatus` como entero de banderas. */
    statusFlags: number | null;
    /** El mismo valor como texto; solo es legible cuando hay una sola bandera. */
    statusText: string | null;
    port: string | null;
    driver: string | null;
  };
  /** Fallo al leer el estado. La UI lo muestra aparte del `state`. */
  error: string | null;
}
