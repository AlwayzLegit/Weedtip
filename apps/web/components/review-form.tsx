'use client';

import { Camera, Loader2, Star, X } from 'lucide-react';
import { useActionState, useRef, useState } from 'react';
import { submitReview, type ReviewState } from '@/app/actions/reviews';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { FormMessage } from './auth/form-message';
import { SubmitButton } from './auth/submit-button';
import { Textarea } from './ui/textarea';

const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

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
  initialPhotoUrls = [],
}: {
  dispensaryId: string;
  dispensarySlug: string;
  initialQuality?: number;
  initialService?: number;
  initialAtmosphere?: number;
  initialBody?: string;
  initialPhotoUrls?: string[];
}) {
  const [state, action] = useActionState<ReviewState, FormData>(submitReview, {});
  const [quality, setQuality] = useState(initialQuality);
  const [service, setService] = useState(initialService);
  const [atmosphere, setAtmosphere] = useState(initialAtmosphere);
  const [photos, setPhotos] = useState<string[]>(initialPhotoUrls);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const complete = quality > 0 && service > 0 && atmosphere > 0;

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setPhotoError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setPhotoError('Sign in to add photos.');
        return;
      }
      const room = MAX_PHOTOS - photos.length;
      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, room)) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > MAX_PHOTO_BYTES) {
          setPhotoError('Photos must be under 8 MB.');
          continue;
        }
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${user.id}/reviews/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from('dispensary-media')
          .upload(path, file, { contentType: file.type });
        if (error) {
          setPhotoError('Upload failed — try again.');
          continue;
        }
        uploaded.push(supabase.storage.from('dispensary-media').getPublicUrl(path).data.publicUrl);
      }
      if (uploaded.length) setPhotos((p) => [...p, ...uploaded].slice(0, MAX_PHOTOS));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

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

      {/* Photos */}
      <input type="hidden" name="photo_urls" value={JSON.stringify(photos)} />
      <div className="flex flex-wrap items-center gap-2">
        {photos.map((url) => (
          <span key={url} className="relative">
            <img
              src={url}
              alt="Review photo"
              className="border-border h-16 w-16 rounded-lg border object-cover"
            />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => setPhotos((p) => p.filter((u) => u !== url))}
              className="bg-background/90 text-foreground absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="border-border text-muted hover:border-primary/50 hover:text-foreground flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed text-[10px] font-medium disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {uploading ? 'Uploading' : 'Add photo'}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void addPhotos(e.target.files)}
        />
      </div>
      {photoError && <p className="text-danger text-xs">{photoError}</p>}

      <SubmitButton disabled={!complete || uploading}>Submit review</SubmitButton>
    </form>
  );
}
