import { redirect } from 'next/navigation';

/** Friendly alias — the dashboard overview lives at /dashboard. */
export default function OverviewRedirect() {
  redirect('/dashboard');
}
