'use client';

import { useActionState, useRef } from 'react';
import { postBrandUpdate } from '@/app/actions/brand-updates';
import { FormMessage } from '@/components/auth/form-message';
import { SubmitButton } from '@/components/auth/submit-button';
import { Field } from '@/components/dashboard/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EMPTY_FORM_STATE } from '@/lib/forms';

export function BrandUpdateForm({ brandId }: { brandId: string }) {
  const [state, action] = useActionState(postBrandUpdate, EMPTY_FORM_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await action(fd);
        formRef.current?.reset();
      }}
      className="space-y-3"
    >
      <FormMessage
        state={{
          error: state.status === 'error' ? state.message : undefined,
          message: state.status === 'success' ? state.message : undefined,
        }}
      />
      <input type="hidden" name="brand_id" value={brandId} />
      <Field label="Title" htmlFor={`title-${brandId}`}>
        <Input
          id={`title-${brandId}`}
          name="title"
          maxLength={140}
          required
          placeholder="New product, collab, restock…"
        />
      </Field>
      <Field label="Message" htmlFor={`body-${brandId}`}>
        <Textarea
          id={`body-${brandId}`}
          name="body"
          rows={3}
          maxLength={2000}
          placeholder="Tell your followers what's new (optional)"
        />
      </Field>
      <SubmitButton>Post update</SubmitButton>
    </form>
  );
}
