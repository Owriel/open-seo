import { isErrorCode, type ErrorCode } from "@/shared/error-codes";

const STANDARD_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Inicia sesión e inténtalo de nuevo.",
  FORBIDDEN: "No tienes acceso a este recurso.",
  NOT_FOUND: "El recurso solicitado no fue encontrado.",
  VALIDATION_ERROR: "Revisa los datos introducidos e inténtalo de nuevo.",
  CRAWL_TARGET_BLOCKED:
    "Este objetivo está bloqueado por la política de seguridad.",
  RATE_LIMITED: "Demasiadas solicitudes. Espera e inténtalo de nuevo.",
  CONFLICT: "Esta solicitud entra en conflicto con datos existentes.",
  INTERNAL_ERROR:
    "Ha ocurrido un error inesperado. Revisa los logs del servidor e inténtalo de nuevo.",
};

export function getStandardErrorMessage(
  error: unknown,
  fallback: string = STANDARD_MESSAGES.INTERNAL_ERROR,
): string {
  if (!(error instanceof Error)) return fallback;
  if (isErrorCode(error.message)) return STANDARD_MESSAGES[error.message];
  return fallback;
}
