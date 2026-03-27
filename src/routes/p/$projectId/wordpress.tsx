import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import {
  FileText,
  Settings,
  Send,
  CheckCircle,
  XCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  saveWpConfig,
  getWpConfig,
  testWpConnection,
  publishToWordPress,
} from "@/serverFunctions/wordpress";
import type { WpConfig, WpPublishResult } from "@/types/wordpress";
import { getStandardErrorMessage } from "@/client/lib/error-messages";

export const Route = createFileRoute("/p/$projectId/wordpress")({
  component: WordPressPage,
});

function WordPressPage() {
  const { projectId } = Route.useParams();
  const [activeTab, setActiveTab] = useState<"config" | "publish">("config");

  // Config state
  const [wpUrl, setWpUrl] = useState("");
  const [wpUser, setWpUser] = useState("");
  const [wpAppPassword, setWpAppPassword] = useState("");
  const [savedConfig, setSavedConfig] = useState<WpConfig | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle");
  const [connectionMessage, setConnectionMessage] = useState("");

  // Publish state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"draft" | "publish">("draft");
  const [lastPublished, setLastPublished] = useState<WpPublishResult | null>(null);

  // Cargar config guardada
  const loadConfig = useCallback(async () => {
    try {
      const result = await getWpConfig({ data: { projectId } });
      if (result.config) {
        setSavedConfig(result.config);
        setWpUrl(result.config.wpUrl);
        setWpUser(result.config.wpUser);
      }
    } catch {
      // silencioso
    }
  }, [projectId]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: () =>
      saveWpConfig({
        data: { projectId, wpUrl: wpUrl.trim(), wpUser: wpUser.trim(), wpAppPassword },
      }),
    onSuccess: () => {
      toast.success("Configuración guardada");
      setWpAppPassword("");
      void loadConfig();
    },
    onError: (err) => toast.error(getStandardErrorMessage(err, "Error al guardar")),
  });

  const testMutation = useMutation({
    mutationFn: () => testWpConnection({ data: { projectId } }),
    onSuccess: (result) => {
      setConnectionStatus(result.success ? "success" : "error");
      setConnectionMessage(result.message);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    },
    onError: (err) => {
      setConnectionStatus("error");
      setConnectionMessage(getStandardErrorMessage(err, "Error de conexión"));
    },
  });

  const publishMutation = useMutation({
    mutationFn: () =>
      publishToWordPress({
        data: { projectId, title: title.trim(), content, status },
      }),
    onSuccess: (result) => {
      setLastPublished(result);
      toast.success(`Post ${result.status === "draft" ? "borrador" : "publicado"} creado (#${result.postId})`);
      setTitle("");
      setContent("");
    },
    onError: (err) => toast.error(getStandardErrorMessage(err, "Error al publicar")),
  });

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wpUrl.trim() || !wpUser.trim() || !wpAppPassword.trim()) {
      toast.error("Completa todos los campos");
      return;
    }
    saveMutation.mutate();
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Título y contenido son obligatorios");
      return;
    }
    if (!savedConfig?.hasPassword) {
      toast.error("Configura WordPress primero");
      setActiveTab("config");
      return;
    }
    publishMutation.mutate();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 md:px-6 pt-4 pb-2 max-w-8xl mx-auto w-full">
        <h1 className="text-xl font-bold mb-1">WordPress</h1>
        <p className="text-sm text-base-content/60 mb-3">
          Conecta tu WordPress y publica borradores con briefs de contenido SEO.
        </p>

        {/* Tabs */}
        <div className="tabs tabs-bordered">
          <button
            className={`tab tab-sm gap-1 ${activeTab === "config" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("config")}
          >
            <Settings className="size-3.5" />
            Configuración
          </button>
          <button
            className={`tab tab-sm gap-1 ${activeTab === "publish" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("publish")}
          >
            <Send className="size-3.5" />
            Publicar
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
        <div className="mx-auto w-full max-w-2xl">
          {activeTab === "config" ? (
            <div className="mt-4 space-y-4">
              {/* Config form */}
              <div className="border border-base-300 rounded-xl bg-base-100 p-5">
                <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
                  <Settings className="size-4 text-primary" />
                  Conexión WordPress
                </h2>

                {savedConfig && (
                  <div className="mb-4 p-3 bg-base-200/50 rounded-lg text-sm">
                    <span className="text-base-content/60">Configurado:</span>{" "}
                    <span className="font-medium">{savedConfig.wpUrl}</span>
                    <span className="text-base-content/40 ml-2">({savedConfig.wpUser})</span>
                  </div>
                )}

                <form className="space-y-3" onSubmit={handleSaveConfig}>
                  <div>
                    <label className="label label-text text-xs">URL de WordPress</label>
                    <input
                      className="input input-bordered input-sm w-full"
                      placeholder="https://tudominio.com"
                      value={wpUrl}
                      onChange={(e) => setWpUrl(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label label-text text-xs">Usuario</label>
                    <input
                      className="input input-bordered input-sm w-full"
                      placeholder="admin"
                      value={wpUser}
                      onChange={(e) => setWpUser(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label label-text text-xs">Application Password</label>
                    <input
                      type="password"
                      className="input input-bordered input-sm w-full"
                      placeholder={savedConfig?.hasPassword ? "••••••••••• (guardada)" : "xxxx xxxx xxxx xxxx"}
                      value={wpAppPassword}
                      onChange={(e) => setWpAppPassword(e.target.value)}
                    />
                    <p className="text-xs text-base-content/40 mt-1">
                      Genérala en WordPress &gt; Usuarios &gt; Tu perfil &gt; Application Passwords
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={saveMutation.isPending}
                    >
                      {saveMutation.isPending ? "Guardando..." : "Guardar configuración"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={!savedConfig?.hasPassword || testMutation.isPending}
                      onClick={() => testMutation.mutate()}
                    >
                      {testMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        "Probar conexión"
                      )}
                    </button>
                  </div>
                </form>

                {/* Connection status */}
                {connectionStatus !== "idle" && (
                  <div
                    className={`mt-3 p-3 rounded-lg flex items-center gap-2 text-sm ${
                      connectionStatus === "success"
                        ? "bg-success/10 text-success"
                        : "bg-error/10 text-error"
                    }`}
                  >
                    {connectionStatus === "success" ? (
                      <CheckCircle className="size-4" />
                    ) : (
                      <XCircle className="size-4" />
                    )}
                    {connectionMessage}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {/* Publish form */}
              <div className="border border-base-300 rounded-xl bg-base-100 p-5">
                <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
                  <Send className="size-4 text-primary" />
                  Publicar en WordPress
                </h2>

                {!savedConfig?.hasPassword && (
                  <div className="mb-4 p-3 bg-warning/10 text-warning rounded-lg text-sm">
                    Configura tu WordPress primero en la pestaña de Configuración.
                  </div>
                )}

                <form className="space-y-3" onSubmit={handlePublish}>
                  <div>
                    <label className="label label-text text-xs">Título del post</label>
                    <input
                      className="input input-bordered input-sm w-full"
                      placeholder="Título del artículo"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label label-text text-xs">Contenido (HTML)</label>
                    <textarea
                      className="textarea textarea-bordered w-full h-48 text-sm"
                      placeholder="<h2>Sección 1</h2>&#10;<p>Contenido del artículo...</p>"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label label-text text-xs">Estado</label>
                    <select
                      className="select select-bordered select-sm w-full max-w-xs"
                      value={status}
                      onChange={(e) => { if (e.target.value === "draft" || e.target.value === "publish") setStatus(e.target.value); }}
                    >
                      <option value="draft">Borrador</option>
                      <option value="publish">Publicar</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-sm mt-2"
                    disabled={publishMutation.isPending || !savedConfig?.hasPassword}
                  >
                    {publishMutation.isPending ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Publicando...
                      </>
                    ) : (
                      <>
                        <Send className="size-3.5" />
                        {status === "draft" ? "Crear borrador" : "Publicar"}
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Último publicado */}
              {lastPublished && (
                <div className="border border-success/30 rounded-xl bg-success/5 p-4">
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2 text-success">
                    <CheckCircle className="size-4" />
                    Post creado correctamente
                  </h3>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-base-content/60">ID:</span> #{lastPublished.postId}
                    </p>
                    <p>
                      <span className="text-base-content/60">Estado:</span>{" "}
                      {lastPublished.status === "draft" ? "Borrador" : "Publicado"}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <a
                        href={lastPublished.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-xs gap-1"
                      >
                        <ExternalLink className="size-3" />
                        Ver post
                      </a>
                      <a
                        href={lastPublished.editUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-xs gap-1"
                      >
                        <FileText className="size-3" />
                        Editar en WP
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
