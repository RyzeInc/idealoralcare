/** Small visual indicator for required form fields. */
export function RequiredMark() {
  return (
    <span aria-label="required" className="ml-0.5 text-red-600" title="Required">
      *
    </span>
  );
}

/** Wrapper for a labeled form field with optional help text + required marker. */
export function FieldLabel({
  htmlFor,
  label,
  required,
  hint,
  children,
}: {
  htmlFor?: string;
  label: string;
  required?: boolean;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <RequiredMark />}
      </label>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {children}
    </div>
  );
}
