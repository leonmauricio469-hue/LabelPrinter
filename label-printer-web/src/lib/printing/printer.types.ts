export interface PrintResult {
  ok: boolean;
  error?: string;
  /** ID del trabajo en la cola de Windows (solo USB). No es el `jobId` de auditoria. */
  spoolerJobId?: number;
}