import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { handleGscCallback } from "@/serverFunctions/opportunities";

// Ruta fija para el callback OAuth de Google Search Console.
// Google redirige aquí con ?code=xxx&state=projectId
// Procesamos el token y redirigimos a la página de oportunidades del proyecto.
export const Route = createFileRoute("/auth/gsc-callback")({
  component: GscCallbackPage,
});

function GscCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const projectId = params.get("state");

    if (!code || !projectId) {
      setError("Faltan parámetros en la respuesta de Google");
      return;
    }

    handleGscCallback({ data: { code, projectId } })
      .then((result) => {
        if (result.success) {
          // Redirigir a la página de oportunidades del proyecto
          navigate({
            to: "/p/$projectId/opportunities",
            params: { projectId },
            search: { gsc_connected: "1" },
          });
        } else {
          setError(result.error ?? "Error al conectar GSC");
        }
      })
      .catch(() => setError("Error al procesar la autorización"));
  }, [navigate]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-3">
          <p className="text-error font-medium">{error}</p>
          <button className="btn btn-sm" onClick={() => window.history.back()}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center space-y-2">
        <div className="loading loading-spinner loading-lg" />
        <p className="text-sm text-base-content/60">Conectando Google Search Console...</p>
      </div>
    </div>
  );
}
