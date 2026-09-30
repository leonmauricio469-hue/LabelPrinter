export interface PrintResult {
  ok: boolean;
  error?: string;
  /** ID del trabajo en la cola de Windows (solo USB). No es el `jobId` de auditoria. */
  spoolerJobId?: number;
  /**
   * Fallo en el que el trabajo PUDO haber llegado a la impresora: timeout con el envio en
   * curso, o conexion cortada a mitad. Reintentar a ciegas puede duplicar etiquetas.
   * Sin esta marca, un fallo es seguro: no se envio nada.
   */
  uncertain?: boolean;
  /** Respuesta repetida de una solicitud ya procesada: no se volvio a enviar nada. */
  duplicate?: boolean;
}