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
  /**
   * Reactive read of the same state — e.g. PatientHeader uses this to show
   * a name as it's being typed on the Personal tab, before it's even been
   * saved. Unlike the internal ref used for autosave (which needs the
   * latest value synchronously without waiting for a re-render), this is
   * plain React state so consumers re-render when it changes.
   */
  activeForm: ActiveFormState | null;
  /**
   * Used by tab navigation instead of a plain link: if the active form has
   * unsaved changes, save it as a draft first, then navigate. This is what
   * makes "moving to the next tab" behave like autosave.
   */
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
  // A ref for navigateWithAutosave, which needs the latest value
  // synchronously (it can fire between renders); state for everything that
  // should visibly react to changes (e.g. the live patient name in the
  // header).
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
          // saveDraft surfaces its own error toast; still let navigation
          // proceed rather than trap the person on the page.
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
