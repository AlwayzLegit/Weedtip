'use client';

import { ImageIcon, Images, Loader2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Label } from '../ui/label';

/** 7 MB, matching the spec's upload ceiling for deal art. */
const MAX_BYTES = 7 * 1024 * 1024;
const ACCEPT = 'image/png,image/jpeg,image/webp';
const IMAGE_RE = /\.(png|jpe?g|webp)$/i;

type Bucket = 'avatars' | 'dispensary-media' | 'product-images';

/**
 * Deal / listing image picker: either upload a new file (PNG/JPG/WebP ≤7 MB,
 * gated behind an ownership-confirmation checkbox) or reuse one already in the
 * shop's media gallery. The resolved public URL is written into a hidden field
 * (`name`) so it submits with the surrounding form — same contract as
 * <ImageUpload>, but with a gallery tab and a client-side size guard.
 */
export function ImagePicker({
  name,
  label,
  defaultUrl,
  bucket = 'dispensary-media',
  hint = 'PNG, JPG, or WebP · up to 7 MB · a ~16:9 image looks best.',
}: {
  name: string;
  label: string;
  defaultUrl?: string | null;
  bucket?: Bucket;
  hint?: string;
}) {
  const [url, setUrl] = useState(defaultUrl ?? '');
  const [tab, setTab] = useState<'upload' | 'gallery'>('upload');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [owns, setOwns] = useState(false);
  const [gallery, setGallery] = useState<string[] | null>(null);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError('That image is over 7 MB. Pick a smaller file.');
      e.target.value = '';
      return;
    }
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
      setGallery(null); // invalidate cached gallery so the new upload shows next visit
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function loadGallery() {
    setGalleryBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setGallery([]);
        return;
      }
      const { data, error: lsErr } = await supabase.storage
        .from(bucket)
        .list(user.id, { limit: 60, sortBy: { column: 'created_at', order: 'desc' } });
      if (lsErr) {
        setGallery([]);
        return;
      }
      const urls = (data ?? [])
        .filter((o) => o.id && IMAGE_RE.test(o.name))
        .map(
          (o) => supabase.storage.from(bucket).getPublicUrl(`${user.id}/${o.name}`).data.publicUrl,
        );
      setGallery(urls);
    } catch {
      setGallery([]);
    } finally {
      setGalleryBusy(false);
    }
  }

  useEffect(() => {
    if (tab === 'gallery' && gallery === null && !galleryBusy) void loadGallery();
  }, [tab, gallery, galleryBusy]);

  return (
    <div>
      <Label>{label}</Label>
      <input type="hidden" name={name} value={url} />

      <div className="flex items-start gap-4">
        {/* 16:9 preview */}
        <div
          className="border-border bg-surface-2 relative aspect-video w-40 shrink-0 overflow-hidden rounded-lg border bg-cover bg-center"
          style={url ? { backgroundImage: `url(${url})` } : undefined}
        >
          {!url && (
            <div className="text-muted flex h-full w-full items-center justify-center">
              <ImageIcon className="h-6 w-6" />
            </div>
          )}
          {url && (
            <button
              type="button"
              onClick={() => setUrl('')}
              aria-label="Remove image"
              className="bg-background/80 hover:bg-background absolute right-1.5 top-1.5 rounded-full p-1 shadow-sm"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          {/* Segmented Upload / Gallery toggle */}
          <div className="border-border bg-surface-2 inline-flex rounded-lg border p-0.5">
            {(['upload', 'gallery'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  tab === t ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground',
                )}
              >
                {t === 'upload' ? <Upload className="h-3.5 w-3.5" /> : <Images className="h-3.5 w-3.5" />}
                {t === 'upload' ? 'Upload' : 'Gallery'}
              </button>
            ))}
          </div>

          {tab === 'upload' ? (
            <div className="space-y-2">
              <label className="text-muted flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={owns}
                  onChange={(e) => setOwns(e.target.checked)}
                  className="accent-primary mt-0.5"
                />
                <span>I own this image or have the rights to use it.</span>
              </label>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={onFile}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || !owns}
                onClick={() => inputRef.current?.click()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {url ? 'Replace image' : 'Upload image'}
              </Button>
              <p className="text-muted text-xs">{hint}</p>
            </div>
          ) : (
            <div>
              {galleryBusy ? (
                <div className="text-muted flex items-center gap-2 py-4 text-xs">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading your images…
                </div>
              ) : !gallery || gallery.length === 0 ? (
                <p className="text-muted py-4 text-xs">
                  No images in your gallery yet. Upload one and it will appear here.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {gallery.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setUrl(g)}
                      aria-label="Use this image"
                      aria-pressed={url === g}
                      className={cn(
                        'aspect-square overflow-hidden rounded-md border bg-cover bg-center transition-all',
                        url === g
                          ? 'border-primary ring-primary/30 ring-2'
                          : 'border-border hover:border-border-strong',
                      )}
                      style={{ backgroundImage: `url(${g})` }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-danger text-xs">{error}</p>}
        </div>
      </div>
    </div>
  );
}
