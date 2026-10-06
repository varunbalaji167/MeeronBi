// Pure (not a hook) because PlainSection renders the <label htmlFor> while FieldInput renders the
// control; both must derive the same ids independently. `--` separates scope, `__` is the grid-cell separator.

export interface FieldIds {
  inputId: string;
  errorId: string;
  helpId: string;
  labelId: string;
  /** Ids of the error and help elements that actually render, error first (matches DOM order). */
  describedBy: string | undefined;
}

export function fieldIds(
  name: string,
  opts: { scope?: string; hasError?: boolean; hasHelp?: boolean } = {}
): FieldIds {
  const inputId = opts.scope ? `${opts.scope}--${name}` : name;
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;
  const describedBy = [opts.hasError && errorId, opts.hasHelp && helpId].filter(Boolean).join(" ") || undefined;
  return { inputId, errorId, helpId, labelId: `${inputId}-label`, describedBy };
}
