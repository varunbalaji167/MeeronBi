"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/context/ToastContext";
import { friendlyErrorMessage } from "@/lib/apiClient";

interface ActiveFormState {
  tabKey: string;
  dirty: boolean;
  /** Live snapshot of the form's current (possibly unsaved) field values. */
  data: Record<string, any>;
  saveDraft: () => Promise<void>;
}

interface TabFormContextValue {
  /** The currently-mounted editable tab form registers itself here. */
  setActiveForm: (state: ActiveFormState | null) => void;
  /** Reactive read of the active form's state, re-rendering consumers on change. */
  activeForm: ActiveFormState | null;
  /** Saves the active form as a draft (if dirty) before navigating. */
  navigateWithAutosave: (href: string) => Promise<void>;
}

const noop = () => {};

const TabFormContext = createContext<TabFormContextValue>({
  setActiveForm: noop,
  activeForm: null,
  navigateWithAutosave: async () => {},
});

export function TabFormProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { showToast } = useToast();
  // Ref for synchronous access (navigateWithAutosave); state for reactive consumers.
  const activeRef = useRef<ActiveFormState | null>(null);
  const [activeForm, setActiveFormState] = useState<ActiveFormState | null>(null);

  const setActiveForm = useCallback((state: ActiveFormState | null) => {
    activeRef.current = state;
    setActiveFormState(state);
  }, []);

  const navigateWithAutosave = useCallback(
    async (href: string) => {
      const active = activeRef.current;
      if (active?.dirty) {
        try {
          await active.saveDraft();
        } catch (err) {
          // Stay put so the user's in-memory edits survive; leaving is an explicit choice.
          showToast(
            friendlyErrorMessage(err, "Couldn't save your changes, so you're still on this page."),
            "error",
            { action: { label: "Leave anyway", onClick: () => router.push(href) } }
          );
          return;
        }
      }
      router.push(href);
    },
    [router, showToast]
  );

  return (
    <TabFormContext.Provider value={{ setActiveForm, activeForm, navigateWithAutosave }}>
      {children}
    </TabFormContext.Provider>
  );
}

export function useTabForm() {
  return useContext(TabFormContext);
}
