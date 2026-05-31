import type { AuthState } from '@/app/actions/auth';

export function FormMessage({ state }: { state: AuthState }) {
  if (state.error) {
    return (
      <p className="border-danger/40 bg-danger/10 text-danger rounded-lg border px-3 py-2 text-sm">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p className="border-primary/40 bg-primary-muted text-primary rounded-lg border px-3 py-2 text-sm">
        {state.message}
      </p>
    );
  }
  return null;
}
