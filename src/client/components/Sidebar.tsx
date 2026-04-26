import { Link } from "@tanstack/react-router";
import { ChevronsUpDown, X } from "lucide-react";
import { projectNavCategories } from "@/client/navigation/items";

// Props del sidebar principal. Compatibilidad con uso mobile (drawer)
// gracias a onClose; onNavigate permite que el drawer se cierre al pulsar link.
interface SidebarProps {
  currentPath: string;
  projectId: string | null;
  onNavigate?: () => void;
  onClose?: () => void;
}

export function Sidebar({
  currentPath,
  projectId,
  onNavigate,
  onClose,
}: SidebarProps) {
  // Cabecera (logo + boton cerrar en mobile)
  const header = (
    <div className="px-4 py-4 border-b border-base-300 flex items-center justify-between shrink-0">
      <span className="font-semibold text-lg text-base-content">OpenSEO</span>
      {onClose && (
        <button
          onClick={onClose}
          className="btn btn-ghost btn-sm btn-circle"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );

  // Footer con selector de proyecto (movido desde top nav)
  const footer = (
    <div className="px-3 py-3 border-t border-base-300 shrink-0">
      <div
        className="tooltip tooltip-top w-full before:whitespace-nowrap"
        data-tip="Multiple projects coming soon"
      >
        <button className="btn btn-ghost btn-sm w-full justify-between font-medium text-sm cursor-default">
          <span className="truncate">Default</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-base-content/40" />
        </button>
      </div>
    </div>
  );

  // Si no hay projectId todavia, mostrar skeleton con header+footer
  // para evitar saltos de layout.
  if (!projectId) {
    return (
      <aside className="w-64 h-full bg-base-100 border-r border-base-300 flex flex-col">
        {header}
        <div className="flex-1 flex items-center justify-center">
          <span className="loading loading-spinner loading-sm" />
        </div>
        {footer}
      </aside>
    );
  }

  return (
    <aside className="w-64 h-full bg-base-100 border-r border-base-300 flex flex-col">
      {header}

      {/* Navegacion agrupada por categorias */}
      <nav className="flex-1 overflow-y-auto py-3">
        {projectNavCategories.map((category) => (
          <div key={category.id} className="px-3 py-2">
            {/* Label de categoria (uppercase, sutil) */}
            <div className="px-2 pb-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-base-content/50">
              {category.label}
            </div>

            {/* Items de la categoria */}
            <div className="flex flex-col gap-0.5">
              {category.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPath.includes(item.matchSegment);

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    params={{ projectId }}
                    onClick={onNavigate}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-base-content/70 hover:bg-base-200 hover:text-base-content"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {footer}
    </aside>
  );
}
