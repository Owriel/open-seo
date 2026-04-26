import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCacheEntries,
  extendCacheEntry,
  deleteCacheEntry,
  bulkCacheAction,
} from "@/serverFunctions/cache";
import {
  Trash2,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle,
  Database,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/p/$projectId/cache")({
  component: CacheManagementPage,
});

function CacheManagementPage() {
  const queryClient = useQueryClient();
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["cacheEntries"],
    queryFn: () => getCacheEntries(),
  });

  const entries = data?.entries ?? [];

  const extendMutation = useMutation({
    mutationFn: (kvKey: string) => extendCacheEntry({ data: { kvKey } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cacheEntries"] });
      toast.success("Caché ampliada 30 días más");
    },
    onError: () => toast.error("Error al ampliar la caché"),
  });

  const deleteMutation = useMutation({
    mutationFn: (kvKey: string) => deleteCacheEntry({ data: { kvKey } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cacheEntries"] });
      toast.success("Entrada de caché eliminada");
    },
    onError: () => toast.error("Error al eliminar"),
  });

  const bulkMutation = useMutation({
    mutationFn: (params: { kvKeys: string[]; action: "extend" | "delete" }) =>
      bulkCacheAction({ data: params }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["cacheEntries"] });
      setSelectedKeys(new Set());
      toast.success(
        variables.action === "extend"
          ? `${variables.kvKeys.length} entradas ampliadas`
          : `${variables.kvKeys.length} entradas eliminadas`,
      );
    },
    onError: () => toast.error("Error en la operación"),
  });

  const now = new Date();

  const getStatus = (expiresAt: string) => {
    const expires = new Date(expiresAt);
    const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / 86400000);
    if (daysLeft <= 0)
      return { label: "Expirada", color: "badge-error", daysLeft: 0 };
    if (daysLeft <= 3)
      return { label: `${daysLeft}d`, color: "badge-warning", daysLeft };
    if (daysLeft <= 7)
      return { label: `${daysLeft}d`, color: "badge-info", daysLeft };
    return { label: `${daysLeft}d`, color: "badge-success", daysLeft };
  };

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedKeys.size === entries.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(entries.map((e) => e.kvKey)));
    }
  };

  // Stats
  const expiringSoon = entries.filter(
    (e) => getStatus(e.expiresAt).daysLeft <= 3,
  ).length;
  const totalEntries = entries.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            Gestión de Caché
          </h1>
          <p className="text-base-content/60 text-sm mt-1">
            Los datos de DataForSEO se guardan 30 días. Al expirar, puedes
            ampliar o borrar.
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void refetch()}>
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat bg-base-200 rounded-box p-4">
          <div className="stat-title text-xs">Total en caché</div>
          <div className="stat-value text-2xl">{totalEntries}</div>
        </div>
        <div className="stat bg-base-200 rounded-box p-4">
          <div className="stat-title text-xs">Expiran pronto (3d)</div>
          <div className="stat-value text-2xl text-warning">{expiringSoon}</div>
        </div>
        <div className="stat bg-base-200 rounded-box p-4">
          <div className="stat-title text-xs">TTL por defecto</div>
          <div className="stat-value text-2xl">30 días</div>
        </div>
      </div>

      {/* Expiring soon alert */}
      {expiringSoon > 0 && (
        <div className="alert alert-warning">
          <AlertTriangle className="h-5 w-5" />
          <span>
            <strong>{expiringSoon}</strong>{" "}
            {expiringSoon === 1 ? "entrada expira" : "entradas expiran"} en los
            próximos 3 días. ¿Quieres ampliar o borrar?
          </span>
          <div className="flex gap-2">
            <button
              className="btn btn-sm btn-success"
              onClick={() => {
                const expiringKeys = entries
                  .filter((e) => getStatus(e.expiresAt).daysLeft <= 3)
                  .map((e) => e.kvKey);
                bulkMutation.mutate({ kvKeys: expiringKeys, action: "extend" });
              }}
              disabled={bulkMutation.isPending}
            >
              Ampliar todas
            </button>
            <button
              className="btn btn-sm btn-error"
              onClick={() => {
                const expiringKeys = entries
                  .filter((e) => getStatus(e.expiresAt).daysLeft <= 3)
                  .map((e) => e.kvKey);
                bulkMutation.mutate({ kvKeys: expiringKeys, action: "delete" });
              }}
              disabled={bulkMutation.isPending}
            >
              Borrar todas
            </button>
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {selectedKeys.size > 0 && (
        <div className="flex items-center gap-3 bg-base-200 rounded-box p-3">
          <span className="text-sm font-medium">
            {selectedKeys.size} seleccionadas
          </span>
          <button
            className="btn btn-sm btn-success"
            onClick={() =>
              bulkMutation.mutate({
                kvKeys: Array.from(selectedKeys),
                action: "extend",
              })
            }
            disabled={bulkMutation.isPending}
          >
            <RefreshCw className="h-3 w-3" />
            Ampliar +30d
          </button>
          <button
            className="btn btn-sm btn-error"
            onClick={() =>
              bulkMutation.mutate({
                kvKeys: Array.from(selectedKeys),
                action: "delete",
              })
            }
            disabled={bulkMutation.isPending}
          >
            <Trash2 className="h-3 w-3" />
            Borrar
          </button>
        </div>
      )}

      {/* Table */}
      {entries.length === 0 ? (
        <div className="text-center py-12 text-base-content/50">
          <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg">No hay datos en caché</p>
          <p className="text-sm">Realiza búsquedas para que se guarden aquí.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={selectedKeys.size === entries.length}
                    onChange={toggleAll}
                  />
                </th>
                <th>Descripción</th>
                <th>Categoría</th>
                <th>Creada</th>
                <th>Expira</th>
                <th>Estado</th>
                <th>Ampliada</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const status = getStatus(entry.expiresAt);
                // JSON.parse devuelve `any`. Validamos el shape para tratarlo
                // como Record<string, unknown> de forma segura.
                // eslint-disable-next-line typescript/no-unsafe-type-assertion, typescript/no-unsafe-assignment
                const parsed: unknown = entry.paramsJson
                  ? JSON.parse(entry.paramsJson)
                  : null;
                const params: Record<string, unknown> | null =
                  parsed !== null &&
                  typeof parsed === "object" &&
                  !Array.isArray(parsed)
                    ? // eslint-disable-next-line typescript/no-unsafe-type-assertion
                      (parsed as Record<string, unknown>)
                    : null;

                return (
                  <tr key={entry.kvKey} className="hover">
                    <td>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={selectedKeys.has(entry.kvKey)}
                        onChange={() => toggleSelect(entry.kvKey)}
                      />
                    </td>
                    <td>
                      <div className="font-medium text-sm">{entry.label}</div>
                      {params && (
                        <div className="text-xs text-base-content/50 mt-0.5">
                          {Object.entries(params)
                            .map(([k, v]) => `${k}: ${String(v)}`)
                            .join(" · ")}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-ghost badge-sm">
                        {entry.category}
                      </span>
                    </td>
                    <td className="text-xs whitespace-nowrap">
                      {formatDate(entry.createdAt)}
                    </td>
                    <td className="text-xs whitespace-nowrap">
                      {formatDate(entry.expiresAt)}
                    </td>
                    <td>
                      <span className={`badge badge-sm ${status.color}`}>
                        {status.daysLeft <= 0 ? (
                          <AlertTriangle className="h-3 w-3 mr-1" />
                        ) : status.daysLeft <= 3 ? (
                          <Clock className="h-3 w-3 mr-1" />
                        ) : (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        )}
                        {status.label}
                      </span>
                    </td>
                    <td className="text-center text-xs">
                      {entry.extendedCount > 0
                        ? `${entry.extendedCount}×`
                        : "—"}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          className="btn btn-ghost btn-xs"
                          title="Ampliar 30 días"
                          onClick={() => extendMutation.mutate(entry.kvKey)}
                          disabled={extendMutation.isPending}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </button>
                        <button
                          className="btn btn-ghost btn-xs text-error"
                          title="Eliminar"
                          onClick={() => deleteMutation.mutate(entry.kvKey)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
