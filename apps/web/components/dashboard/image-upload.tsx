'use client';

import { ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '../ui/button';
import { Label } from '../ui/label';

/**
 * Uploads an image to a Supabase Storage bucket and writes the resulting public
 * URL into a hidden form field (`name`), so it submits with the surrounding form.
 * Objects are stored under `<uid>/...` to satisfy the storage RLS policy.
 */
export function ImageUpload({
  bucket,
  name,
  label,
  defaultUrl,
}: {
  bucket: 'avatars' | 'dispensary-media' | 'product-images';
  name: string;
  label: string;
  defaultUrl?: string | null;
}) {
  const [url, setUrl] = useState(defaultUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be signed in to upload.');
        return;
      }
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) {
        setError(upErr.message);
        return;
      }
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      setUrl(data.publicUrl);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Label>{label}</Label>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-center gap-3">
        <div
          className="border-border bg-surface-2 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-cover bg-center"
          style={url ? { backgroundImage: `url(${url})` } : undefined}
        >
          {!url && <ImageIcon className="text-muted h-5 w-5" />}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={onFile}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {url ? 'Replace' : 'Upload'}
          </Button>
          {url && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setUrl('')}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {error && <p className="text-danger mt-1 text-xs">{error}</p>}
    </div>
  );
}
