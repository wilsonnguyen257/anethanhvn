import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useDialog } from '../../hooks/useDialog';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { useLanguage } from '../../contexts/LanguageContext';

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });
}

/**
 * Draws the selected crop region onto a canvas at its native pixel size and
 * returns it as a File. Output is PNG (lossless) deliberately — this file is
 * an intermediate input to the existing compressImage/processImageForUpload
 * pipeline, which re-encodes to WebP anyway. Re-encoding to a lossy format
 * here first would compound quality loss for no benefit.
 */
async function getCroppedImg(imageSrc: string, cropPixels: Area, fileName: string): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cropPixels.width);
  canvas.height = Math.round(cropPixels.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    cropPixels.width,
    cropPixels.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas produced an empty blob'));
        return;
      }
      resolve(new File([blob], fileName, { type: 'image/png' }));
    }, 'image/png', 1);
  });
}

interface ImageCropModalProps {
  file: File;
  aspect: number;
  onCropComplete: (croppedFile: File) => void;
  onCancel: () => void;
  title?: string;
}

// A crop-and-zoom step inserted right after picking a file, before it's
// resized/uploaded. Follows the Gallery lightbox's visual convention (scrim +
// centered card + shared .btn classes) rather than a bolted-on library widget
// — see src/pages/Gallery.tsx's lightbox for the pattern this mirrors.
export default function ImageCropModal({ file, aspect, onCropComplete, onCancel, title }: ImageCropModalProps) {
  const { t } = useLanguage();
  const imageSrc = useMemo(() => URL.createObjectURL(file), [file]);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => URL.revokeObjectURL(imageSrc);
  }, [imageSrc]);

  const dialogRef = useRef<HTMLDivElement>(null);
  useDialog(dialogRef, true, onCancel);

  const handleCropComplete = useCallback((_croppedArea: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels, file.name);
      onCropComplete(croppedFile);
    } catch (err) {
      console.error('Crop failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-6 py-12"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || t('admin.crop.title')}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] bg-slate-100 rounded-2xl p-6 flex flex-col gap-4 shadow-[0_2px_6px_rgba(2,2,2,0.14),0_12px_32px_rgba(2,2,2,0.10)]"
      >
        <h2 className="text-lg font-semibold text-slate-900">{title || t('admin.crop.title')}</h2>

        <div className="relative w-full h-[420px] rounded-xl overflow-hidden bg-slate-800">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{t('admin.crop.zoom')}</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-brand-600"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn btn-outline" disabled={saving}>
            {t('admin.gallery.cancel')}
          </button>
          <button type="button" onClick={handleSave} className="btn btn-primary" disabled={saving || !croppedAreaPixels}>
            {saving ? t('admin.crop.saving') : t('admin.crop.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
