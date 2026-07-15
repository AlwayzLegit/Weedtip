import { redirect } from 'next/navigation';

/** Friendly alias — the in-store promos live at /dashboard/promos. */
export default function InStoreRedirect() {
  redirect('/dashboard/promos');
}
