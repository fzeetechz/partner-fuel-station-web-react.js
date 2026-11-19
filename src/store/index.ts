import { clearTokens } from "../services/api/tokens";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Session } from "../types";
interface UIState {
  session: Session | null;
  stationId: string;
  theme: "light" | "dark";
  language: "en" | "fr";
  collapsed: boolean;
  setSession: (session: Session | null) => void;
  setStation: (id: string) => void;
  setTheme: (theme: "light" | "dark") => void;
  setLanguage: (language: "en" | "fr") => void;
  toggleSidebar: () => void;
}
export const useAppStore = create<UIState>()(
  persist(
    (set) => ({
      session: null,
      stationId: "",
      theme: "light",
      language: "en",
      collapsed: false,
      setSession: (session) => {
        if (!session) clearTokens();
        set({ session, stationId: session?.stationIds[0] || "" });
      },
      setStation: (stationId) => set({ stationId }),
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      toggleSidebar: () => set((s) => ({ collapsed: !s.collapsed })),
    }),
    {
      name: "neyfuel-preferences-v1",
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        collapsed: state.collapsed,
      }),
    },
  ),
);
