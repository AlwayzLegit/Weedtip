import { type ZodError } from 'zod';

/**
 * Shared result shape for Server Action–backed forms (used with `useActionState`).
 * One contract across every dashboard mutation so forms render errors uniformly —
 * and the same shape the Flutter app's form layer will mirror.
 */
export type FormState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  /** First error message per field, keyed by field name. */
  fieldErrors?: Record<string, string>;
};

export const EMPTY_FORM_STATE: FormState = { status: 'idle' };

export function fromZodError(error: ZodError): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.errors) {
    const key = issue.path.join('.') || '_form';
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { status: 'error', message: 'Please fix the highlighted fields.', fieldErrors };
}

export function formError(message: string): FormState {
  return { status: 'error', message };
}

export function formSuccess(message?: string): FormState {
  return { status: 'success', message };
}

// ─── FormData coercion helpers (FormData is all strings) ─────────────────────
export function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === 'on' || v === 'true';
}

export function numOpt(fd: FormData, key: string): number | undefined {
  const v = str(fd, key);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
