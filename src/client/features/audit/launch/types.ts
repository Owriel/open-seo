import { useForm } from "@tanstack/react-form";

export type LaunchState = {
  isSettingsOpen: boolean;
  showPsiKey: boolean;
  urlError: string | null;
  psiRequirementError: string | null;
  startError: string | null;
  settingsError: string | null;
};

export const MIN_PAGES = 10;
export const MAX_PAGES_LIMIT = 10_000;

// URL inicial opcional (p. ej. el dominio del proyecto) para que el usuario
// no tenga que re-escribirlo cada vez.
export function useLaunchForm(defaultUrl?: string) {
  return useForm({
    defaultValues: {
      url: defaultUrl ?? "",
      maxPagesInput: "50",
      runPsi: false,
      psiMode: "auto" as "auto" | "all",
    },
  });
}

export function useSettingsForm() {
  return useForm({ defaultValues: { psiApiKey: "" } });
}

export type LaunchFormApi = ReturnType<typeof useLaunchForm>;
export type SettingsFormApi = ReturnType<typeof useSettingsForm>;
