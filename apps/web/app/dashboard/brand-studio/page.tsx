import { redirect } from 'next/navigation';

/** Friendly alias — Brand Studio lives at /studio. */
export default function BrandStudioRedirect() {
  redirect('/studio');
}
