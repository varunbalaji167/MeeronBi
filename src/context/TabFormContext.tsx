"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
        } catch {
          // saveDraft shows its own error toast; navigation proceeds regardless.
        }
      }
      router.push(href);
    },
    [router]
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
