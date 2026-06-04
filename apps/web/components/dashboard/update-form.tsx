'use client';

import { useActionState, useRef } from 'react';
import { postDispensaryUpdate } from '@/app/actions/updates';
import { FormMessage } from '@/components/auth/form-message';
import { SubmitButton } from '@/components/auth/submit-button';
import { Field } from '@/components/dashboard/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EMPTY_FORM_STATE } from '@/lib/forms';

export function UpdateForm({ dispensaryId }: { dispensaryId: string }) {
  const [state, action] = useActionState(postDispensaryUpdate, EMPTY_FORM_STATE);
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
      <input type="hidden" name="dispensary_id" value={dispensaryId} />
      <Field label="Title" htmlFor="title">
        <Input id="title" name="title" maxLength={140} required placeholder="New drop, hours change…" />
      </Field>
      <Field label="Message" htmlFor="body">
        <Textarea id="body" name="body" rows={3} maxLength={2000} placeholder="Tell your followers what's new (optional)" />
      </Field>
      <SubmitButton>Post update</SubmitButton>
    </form>
  );
}
