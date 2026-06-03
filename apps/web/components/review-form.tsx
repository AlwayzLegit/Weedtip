'use client';

import { Star } from 'lucide-react';
import { useActionState, useState } from 'react';
import { submitReview, type ReviewState } from '@/app/actions/reviews';
import { cn } from '@/lib/utils';
import { FormMessage } from './auth/form-message';
import { SubmitButton } from './auth/submit-button';
import { Textarea } from './ui/textarea';

function StarPicker({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium">{label}</span>
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${label}: ${i} star${i > 1 ? 's' : ''}`}
            aria-checked={value === i}
            role="radio"
          >
            <Star
              className={cn(
                'h-6 w-6 transition-colors',
                i <= (hover || value) ? 'fill-primary text-primary' : 'text-border',
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReviewForm({
  dispensaryId,
  dispensarySlug,
  initialQuality = 0,
  initialService = 0,
  initialAtmosphere = 0,
  initialBody = '',
}: {
  dispensaryId: string;
  dispensarySlug: string;
  initialQuality?: number;
  initialService?: number;
  initialAtmosphere?: number;
  initialBody?: string;
}) {
  const [state, action] = useActionState<ReviewState, FormData>(submitReview, {});
  const [quality, setQuality] = useState(initialQuality);
  const [service, setService] = useState(initialService);
  const [atmosphere, setAtmosphere] = useState(initialAtmosphere);
  const complete = quality > 0 && service > 0 && atmosphere > 0;

  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <input type="hidden" name="dispensary_id" value={dispensaryId} />
      <input type="hidden" name="dispensary_slug" value={dispensarySlug} />

      <div className="border-border bg-surface-2 space-y-2 rounded-lg border p-3">
        <StarPicker name="quality" label="Quality" value={quality} onChange={setQuality} />
        <StarPicker name="service" label="Service" value={service} onChange={setService} />
        <StarPicker
          name="atmosphere"
          label="Atmosphere"
          value={atmosphere}
          onChange={setAtmosphere}
        />
      </div>

      <Textarea
        name="body"
        placeholder="Share your experience (optional)"
        defaultValue={initialBody}
        maxLength={4000}
      />
      <SubmitButton disabled={!complete}>Submit review</SubmitButton>
    </form>
  );
}
