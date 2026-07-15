'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { createBrand } from '@/app/actions/brands';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { SubmitButton } from '../auth/submit-button';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

/** Self-serve brand creation form. On success, points the owner to Brand Studio. */
export function BrandCreateForm() {
  const [state, action] = useActionState(createBrand, EMPTY_FORM_STATE);

  if (state.status === 'success') {
    return (
      <div className="rounded-card border-primary/30 bg-primary-muted border p-5">
        <p className="text-primary font-medium">Brand submitted 🎉</p>
        <p className="text-muted mt-1 text-sm">{state.message}</p>
        <Link href="/studio" className="mt-3 inline-block">
          <Button size="sm">Open Brand Studio</Button>
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="name">Brand name</Label>
        <Input id="name" name="name" required maxLength={80} placeholder="e.g. Sunset Extracts" />
      </div>
      <div>
        <Label htmlFor="website">Website (optional)</Label>
        <Input id="website" name="website" maxLength={200} placeholder="https://…" />
      </div>
      <div>
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          name="description"
          maxLength={2000}
          placeholder="Tell shoppers what your brand is about."
        />
      </div>
      {state.status === 'error' && state.message && (
        <p className="border-danger/40 bg-danger/10 text-danger rounded-lg border px-3 py-2 text-sm">
          {state.message}
        </p>
      )}
      <SubmitButton>Create brand</SubmitButton>
      <p className="text-muted text-xs">
        Your brand goes live after a quick review. Already on Weedtip?{' '}
        <Link href="/brands" className="text-primary hover:underline">
          Claim it instead
        </Link>
        .
      </p>
    </form>
  );
}
