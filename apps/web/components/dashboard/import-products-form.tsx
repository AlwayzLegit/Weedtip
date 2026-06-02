'use client';

import { useActionState } from 'react';
import { importProducts } from '@/app/dashboard/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { FormMessage } from '../auth/form-message';
import { SubmitButton } from '../auth/submit-button';
import { Textarea } from '../ui/textarea';

const SAMPLE = `name,category,price,brand,strain_type,thc,cbd,unit,description,in_stock
OG Kush 3.5g,flower,45,Cookies,hybrid,22.5,0.1,eighth,Earthy classic hybrid,true
Blue Dream Cart 1g,vapes,50,Stiiizy,hybrid,85,0.5,cartridge,Sweet berry vape,true
Wyld Gummies 100mg,edibles,25,Wyld,,,,pack,Real-fruit gummies,true`;

export function ImportProductsForm() {
  const [state, action] = useActionState(importProducts, EMPTY_FORM_STATE);

  return (
    <form action={action} className="space-y-4">
      <FormMessage
        state={{
          error: state.status === 'error' ? state.message : undefined,
          message: state.status === 'success' ? state.message : undefined,
        }}
      />
      <Textarea name="csv" rows={14} defaultValue={SAMPLE} className="font-mono text-xs" />
      <SubmitButton>Import products</SubmitButton>
    </form>
  );
}
