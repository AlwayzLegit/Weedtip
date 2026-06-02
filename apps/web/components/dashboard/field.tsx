import { type ReactNode } from 'react';
import { Label } from '../ui/label';

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-muted mt-1 text-xs">{hint}</p>}
      {error && <p className="text-danger mt-1 text-xs">{error}</p>}
    </div>
  );
}

export function Checkbox({
  name,
  label,
  value,
  defaultChecked,
}: {
  name: string;
  label: string;
  value?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="border-border bg-surface text-primary focus:ring-primary h-4 w-4 rounded"
      />
      {label}
    </label>
  );
}
