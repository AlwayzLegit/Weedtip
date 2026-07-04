'use client';

import { useActionState } from 'react';
import { setDispensaryPlan } from '@/app/admin/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { FormMessage } from '../auth/form-message';
import { SubmitButton } from '../auth/submit-button';
import { Field } from '../dashboard/field';
import { Select } from '../ui/select';
import { DispensaryPicker } from './dispensary-picker';

export function PlanAssignForm({ plans }: { plans: { id: string; name: string }[] }) {
  const [state, action] = useActionState(setDispensaryPlan, EMPTY_FORM_STATE);

  return (
    <form action={action} className="space-y-4">
      <FormMessage
        state={{
          error: state.status === 'error' ? state.message : undefined,
          message: state.status === 'success' ? state.message : undefined,
        }}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Dispensary" htmlFor="dispensary_id">
          <DispensaryPicker />
        </Field>
        <Field label="Plan" htmlFor="plan_id">
          <Select id="plan_id" name="plan_id">
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue="active">
            <option value="active">Active</option>
            <option value="past_due">Past due</option>
            <option value="canceled">Canceled</option>
          </Select>
        </Field>
      </div>
      <SubmitButton>Assign plan</SubmitButton>
    </form>
  );
}
