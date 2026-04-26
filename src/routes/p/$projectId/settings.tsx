// oxlint-disable max-lines -- Formulario CRUD con 5 secciones + sub-componentes de presentación (FormSection, LabelledInput)
// Settings del proyecto.
//
// Formulario con los campos editables del proyecto: nombre, dominio, keyword
// principal, location, idioma, place_id GBP, nombre del negocio y PageSpeed
// API key. Al guardar llama a updateProjectSettings y redirige al dashboard.
//
// Usamos useState + submit manual (patrón ReviewsForm) en vez de TanStack
// Form porque el form es puramente CRUD sin validación cruzada y así mantenemos
// la consistencia visual con el resto de formularios simples de la app.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  Globe,
  Info,
  KeyRound,
  Languages,
  Loader2,
  MapPin,
  Save,
  Search,
  Settings as SettingsIcon,
  Store,
} from "lucide-react";
import {
  getProjectDashboard,
  updateProjectSettings,
} from "@/serverFunctions/project";
import { getStandardErrorMessage } from "@/client/lib/error-messages";

export const Route = createFileRoute("/p/$projectId/settings")({
  component: ProjectSettingsPage,
});

// Listado de países soportados. Los valores los consumen los módulos que usan
// DataForSEO (Reviews, Geo-Grid, etc.), que aceptan el formato "en inglés"
// a nivel país. Mantenemos este subset acotado para no abrumar al usuario.
const COUNTRY_OPTIONS: ReadonlyArray<string> = [
  "Spain",
  "United States",
  "United Kingdom",
  "Germany",
  "France",
  "Italy",
  "Portugal",
  "México",
  "Argentina",
  "Chile",
  "Colombia",
  "Perú",
  "Australia",
  "Canada",
  "India",
  "Brazil",
];

// Idiomas soportados. Alineados con los selectores ya existentes en la app
// (ReviewsForm, KeywordResearchForm, etc.).
const LANGUAGE_OPTIONS: ReadonlyArray<{ code: string; label: string }> = [
  { code: "es", label: "Español" },
  { code: "en", label: "Inglés" },
  { code: "de", label: "Alemán" },
  { code: "fr", label: "Francés" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Portugués" },
];

// oxlint-disable-next-line max-lines-per-function -- Página con múltiples secciones de formulario
function ProjectSettingsPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Cargamos el proyecto por el mismo endpoint que el dashboard: reutilizamos
  // caché de react-query si el usuario viene del dashboard.
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["projectDashboard", projectId],
    queryFn: () => getProjectDashboard({ data: { projectId } }),
  });

  // Estado local del formulario. Se inicializa vacío y se hidrata con useEffect
  // cuando data está disponible (evita romper el flujo de hooks con renders
  // condicionales).
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [locationName, setLocationName] = useState("Spain");
  const [languageCode, setLanguageCode] = useState("es");
  const [placeId, setPlaceId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [pagespeedApiKey, setPagespeedApiKey] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Hidratamos el estado con los valores actuales del proyecto cuando llegan.
  useEffect(() => {
    if (!data) return;
    const p = data.project;
    setName(p.name ?? "");
    setDomain(p.domain ?? "");
    setTargetKeyword(p.targetKeyword ?? "");
    setLocationName(p.locationName ?? "Spain");
    setLanguageCode(p.languageCode ?? "es");
    setPlaceId(p.placeId ?? "");
    setBusinessName(p.businessName ?? "");
    setPagespeedApiKey(p.pagespeedApiKey ?? "");
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateProjectSettings({
        data: {
          projectId,
          name: name.trim(),
          domain: domain.trim() || null,
          targetKeyword: targetKeyword.trim() || null,
          locationName: locationName.trim() || null,
          languageCode: languageCode.trim() || null,
          placeId: placeId.trim() || null,
          businessName: businessName.trim() || null,
          pagespeedApiKey: pagespeedApiKey.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Configuración guardada");
      // Invalidamos el dashboard y el proyecto del layout para que se recarguen
      // con los nuevos valores.
      void queryClient.invalidateQueries({
        queryKey: ["projectDashboard", projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["project", projectId],
      });
      // Redirect al dashboard.
      void navigate({
        to: "/p/$projectId",
        params: { projectId },
      });
    },
    onError: (err) => {
      setFormError(
        getStandardErrorMessage(err, "No se pudo guardar la configuración"),
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // El nombre es el único campo obligatorio. El resto puede quedar en blanco.
    if (!name.trim()) {
      setFormError("El nombre del proyecto es obligatorio.");
      return;
    }

    saveMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-auto">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-64 w-full rounded-xl" />
          <div className="skeleton h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error flex items-start gap-2">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>
              {getStandardErrorMessage(
                error,
                "No se pudo cargar la configuración del proyecto.",
              )}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const isSaving = saveMutation.isPending;

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-auto">
      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <SettingsIcon className="size-6" />
            Ajustes del proyecto
          </h1>
          <p className="text-sm text-base-content/70 mt-1">
            Estos valores autorrellenan los formularios de todos los módulos
            (keywords, dominio, SERP, reseñas, backlinks, geo-grid, etc.).
          </p>
        </div>

        {/* Sección: Identidad del proyecto */}
        <FormSection
          title="Identidad del proyecto"
          description="Nombre interno y datos básicos que identifican este proyecto."
        >
          <LabelledInput
            label="Nombre del proyecto"
            required
            icon={<SettingsIcon className="size-4" />}
          >
            <input
              type="text"
              className="input input-bordered w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Fiscalis Gestoría Valencia"
              disabled={isSaving}
              required
              maxLength={200}
            />
          </LabelledInput>

          <LabelledInput
            label="Nombre del negocio (lo que aparece en Google Business Profile)"
            icon={<Store className="size-4" />}
          >
            <input
              type="text"
              className="input input-bordered w-full"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ej: Fiscalis · Asesoría Fiscal Valencia"
              disabled={isSaving}
              maxLength={300}
            />
          </LabelledInput>
        </FormSection>

        {/* Sección: SEO objetivo */}
        <FormSection
          title="SEO objetivo"
          description="Dominio y keyword principal que se usarán por defecto en todos los análisis."
        >
          <LabelledInput
            label="Dominio objetivo"
            icon={<Globe className="size-4" />}
            hint="Sin http:// ni https://. Ej: fiscalis.es"
          >
            <input
              type="text"
              className="input input-bordered w-full"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="fiscalis.es"
              disabled={isSaving}
              maxLength={500}
            />
          </LabelledInput>

          <LabelledInput
            label="Keyword principal"
            icon={<Search className="size-4" />}
            hint="La keyword que mejor describe el negocio."
          >
            <input
              type="text"
              className="input input-bordered w-full"
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              placeholder="gestoria valencia"
              disabled={isSaving}
              maxLength={500}
            />
          </LabelledInput>
        </FormSection>

        {/* Sección: Ubicación e idioma */}
        <FormSection
          title="Ubicación e idioma"
          description="Parámetros que DataForSEO y otras APIs usan para localizar las búsquedas."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <LabelledInput
              label="Ubicación (país)"
              icon={<MapPin className="size-4" />}
            >
              <select
                className="select select-bordered w-full"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                disabled={isSaving}
              >
                {COUNTRY_OPTIONS.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </LabelledInput>

            <LabelledInput
              label="Idioma"
              icon={<Languages className="size-4" />}
            >
              <select
                className="select select-bordered w-full"
                value={languageCode}
                onChange={(e) => setLanguageCode(e.target.value)}
                disabled={isSaving}
              >
                {LANGUAGE_OPTIONS.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label} ({lang.code})
                  </option>
                ))}
              </select>
            </LabelledInput>
          </div>
        </FormSection>

        {/* Sección: Google Business Profile */}
        <FormSection
          title="Google Business Profile"
          description="Identificador del negocio en Google Maps (place_id). Solo necesario para Geo-Grid y Reseñas."
        >
          <LabelledInput
            label="place_id de Google Maps (opcional)"
            icon={<MapPin className="size-4" />}
            hint="Se puede obtener desde Geo-Grid al buscar tu negocio, o desde maps.google.com en la URL."
          >
            <input
              type="text"
              className="input input-bordered w-full font-mono text-sm"
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
              placeholder="ChIJ0X3BwyxzYg0RxXsKKcxM..."
              disabled={isSaving}
              maxLength={500}
            />
          </LabelledInput>
        </FormSection>

        {/* Sección: API keys */}
        <FormSection
          title="API keys"
          description="Credenciales externas necesarias para los módulos que las requieren."
        >
          <LabelledInput
            label="PageSpeed Insights API key (opcional)"
            icon={<KeyRound className="size-4" />}
            hint="Sin key, PageSpeed funciona pero con límite de cuota bajo. Recomendado para auditorías regulares."
          >
            <input
              type="password"
              className="input input-bordered w-full font-mono text-sm"
              value={pagespeedApiKey}
              onChange={(e) => setPagespeedApiKey(e.target.value)}
              placeholder="AIza..."
              disabled={isSaving}
              autoComplete="off"
              maxLength={500}
            />
          </LabelledInput>
        </FormSection>

        {/* Error global del form */}
        {formError ? (
          <div className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error flex items-start gap-2">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        ) : null}

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
          <button
            type="submit"
            className="btn btn-primary gap-2"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="size-4" />
                Guardar configuración
              </>
            )}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={isSaving}
            onClick={() =>
              void navigate({
                to: "/p/$projectId",
                params: { projectId },
              })
            }
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componentes de presentación
// ---------------------------------------------------------------------------

// Bloque con título + descripción + contenedor para un grupo de inputs.
// Mantiene consistencia visual entre secciones del formulario.
function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-base-100 border border-base-300 rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-xs text-base-content/60 mt-0.5">{description}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// Input con label arriba + icono opcional + hint debajo.
// Así evitamos repetir estructura en cada campo.
function LabelledInput({
  label,
  required,
  icon,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  icon?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="form-control w-full">
      <span className="label label-text text-sm font-medium flex items-center gap-1.5 pb-1">
        {icon}
        {label}
        {required ? <span className="text-error">*</span> : null}
      </span>
      {children}
      {hint ? (
        <span className="text-xs text-base-content/50 mt-1 flex items-start gap-1">
          <Info className="size-3 shrink-0 mt-0.5" />
          <span>{hint}</span>
        </span>
      ) : null}
    </label>
  );
}
