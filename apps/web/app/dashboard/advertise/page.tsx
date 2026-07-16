import { redirect } from 'next/navigation';

/** Friendly alias — regional ad buying lives at /advertise. */
export default function AdvertiseRedirect() {
  redirect('/advertise');
}
