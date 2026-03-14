import { Link, rootRouteId, useMatch, useRouter } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import {
  getErrorCode,
  getStandardErrorMessage,
} from "@/client/lib/error-messages";
import { AuthConfigErrorCard } from "@/client/components/AuthConfigErrorCard";

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  });

  const message = getStandardErrorMessage(
    error,
    "Algo salió mal. Inténtalo de nuevo.",
  );
  const errorCode = getErrorCode(error);
  const showAuthConfigHelp = errorCode === "AUTH_CONFIG_MISSING";

  if (showAuthConfigHelp) {
    return (
      <div className="min-w-0 flex-1 p-4 flex items-center justify-center">
        <AuthConfigErrorCard
          message={message}
          onRetry={() => {
            void router.invalidate();
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1 p-4 flex flex-col items-center justify-center gap-6">
      <p className="text-center text-error">{message}</p>
      <div className="flex gap-2 items-center flex-wrap">
        <button
          onClick={() => {
            void router.invalidate();
          }}
          className="btn btn-neutral btn-sm uppercase"
        >
          Reintentar
        </button>
        {isRoot ? (
          <Link to="/" className="btn btn-neutral btn-sm uppercase">
            Inicio
          </Link>
        ) : (
          <Link
            to="/"
            className="btn btn-neutral btn-sm uppercase"
            onClick={(e) => {
              e.preventDefault();
              window.history.back();
            }}
          >
            Volver
          </Link>
        )}
      </div>
    </div>
  );
}
