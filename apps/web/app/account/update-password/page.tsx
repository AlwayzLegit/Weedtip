import type { Metadata } from 'next';
import { UpdatePasswordForm } from '@/components/auth/update-password-form';

export const metadata: Metadata = { title: 'Update password' };

export default function UpdatePasswordPage() {
  // Account layout already guarantees an active session — including the recovery
  // session established by the reset-email callback, which lands here.
  return (
    <div className="max-w-md space-y-1">
      <h2 className="text-lg font-semibold">Update password</h2>
      <p className="text-muted pb-4 text-sm">Choose a new password for your account.</p>
      <UpdatePasswordForm />
    </div>
  );
}
