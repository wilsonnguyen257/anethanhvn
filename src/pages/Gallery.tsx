import { useState, useEffect, useMemo, useRef } from 'react';
import SEO from '../components/SEO';
import { useDialog } from '../hooks/useDialog';
import { useLanguage } from '../contexts/LanguageContext';
import { subscribeJson } from '../lib/storage';
import { GallerySkeleton } from '../components/Skeleton';

type GalleryCategory = 'mass' | 'events' | 'youth';
type GalleryItem = { id: string; url: string; name: string; created: number; thumbnailUrl?: string; category?: GalleryCategory };
type GalleryGroup = { key: string; label: string; items: GalleryItem[] };

// Groups items into month buckets, in the order they appear (caller controls sort order).
function groupByMonth(items: GalleryItem[], locale: string): GalleryGroup[] {
  const groups: GalleryGroup[] = [];
  const indexByKey = new Map<string, number>();

  for (const item of items) {
    const d = new Date(item.created);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let idx = indexByKey.get(key);
    if (idx === undefined) {
      const label = d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
      idx = groups.push({ key, label, items: [] }) - 1;
      indexByKey.set(key, idx);
    }
    groups[idx].items.push(item);
  }

  return groups;
}

export default function Gallery() {
  const { t, language } = useLanguage();
  const [images, setImages] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<GalleryCategory | 'all'>('all');
  const [lightboxImg, setLightboxImg] = useState<GalleryItem | null>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  useDialog(lightboxRef, lightboxImg !== null, () => setLightboxImg(null));

  const filters: { value: GalleryCategory | 'all'; label: string }[] = [
    { value: 'all', label: t('gallery.filter_all') },
    { value: 'mass', label: t('gallery.filter_mass') },
    { value: 'events', label: t('gallery.filter_events') },
    { value: 'youth', label: t('gallery.filter_youth') },
  ];

  // Load gallery items from Firebase Storage JSON
  useEffect(() => {
    const unsub = subscribeJson<GalleryItem[]>(
      'gallery',
      (items) => {
        setImages(items || []);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => { unsub(); };
  }, []);

  const filteredSorted = useMemo(() => {
    const filtered = categoryFilter === 'all'
      ? images
      : images.filter((img) => img.category === categoryFilter);
    return [...filtered].sort((a, b) => b.created - a.created);
  }, [images, categoryFilter]);

  const groups = useMemo(
    () => groupByMonth(filteredSorted, language === 'vi' ? 'vi-VN' : 'en-US'),
    [filteredSorted, language]
  );

  const clearFilters = () => setCategoryFilter('all');

  return (
    <div className="bg-surface">
      <SEO
        title={t('gallery.title')}
        description={t('gallery.subtitle')}
      />

      <section className="pt-16 pb-2 text-center">
        <div className="container-xl">
          <h1 className="h1 !text-4xl md:!text-5xl">{t('gallery.title')}</h1>
          <p className="mt-4 text-slate-600 max-w-xl mx-auto leading-relaxed">{t('gallery.subtitle')}</p>
        </div>
      </section>

      {/* Category filter row — centered, selected = primary, per the
          prototype. Categories are admin-assigned per photo on upload. */}
      {!loading && images.length > 0 && (
        <section className="pt-10">
          <div className="container-xl flex gap-2 justify-center flex-wrap">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setCategoryFilter(f.value)}
                className={`btn !py-2 !px-4 text-sm ${categoryFilter === f.value ? 'btn-primary' : 'btn-outline'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Gallery Grid Section */}
      <section className="pt-6 pb-20">
        <div className="container-xl">
          {loading ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(i => (
                <GallerySkeleton key={i} />
              ))}
            </div>
          ) : images.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-20 !border-2 !border-dashed">
              <div className="w-16 h-16 rounded-full bg-surface border border-slate-200 flex items-center justify-center mb-6 text-slate-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('gallery.empty')}</h3>
              <p className="text-slate-600 text-sm">{language === 'vi' ? 'Hình ảnh sẽ được cập nhật sớm.' : 'Photos will be added soon.'}</p>
            </div>
          ) : filteredSorted.length === 0 ? (
            <div className="text-center py-16 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-surface border border-slate-200 flex items-center justify-center mx-auto mb-6 text-slate-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">{t('gallery.no_results')}</h3>
              <p className="text-slate-600 mb-6">{t('gallery.no_results_desc')}</p>
              <button onClick={clearFilters} className="btn btn-primary">
                {t('gallery.clear_filters')}
              </button>
            </div>
          ) : (
            <div className="space-y-14">
              {groups.map((group) => (
                <div key={group.key}>
                  <p className="eyebrow mb-6 capitalize">{group.label}</p>
                  {/* 4-up grid (→2 →1), 16px gap, 200px tiles — per the
                      prototype. Captions sit below the image, centered,
                      never over it (DESIGN.md § Backgrounds). */}
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    {group.items.map((img) => (
                      <div
                        key={img.id}
                        role="button"
                        tabIndex={0}
                        aria-haspopup="dialog"
                        aria-label={img.name}
                        className="group card !p-0 overflow-hidden cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                        onClick={() => setLightboxImg(img)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setLightboxImg(img);
                          }
                        }}
                      >
                        <div className="h-[200px] bg-slate-200 overflow-hidden relative">
                          <img
                            src={img.thumbnailUrl || img.url}
                            alt={img.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>

                        <div className="px-4 py-3 border-t border-slate-200 text-center">
                          <p className="text-sm font-semibold text-slate-800 line-clamp-1" title={img.name}>
                            {img.name}
                          </p>
                          <p className="nums-lining text-xs text-slate-600 mt-0.5">
                            {new Date(img.created).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Lightbox — a simple centered card on an ink-tinted scrim, per the
          prototype: one image, a caption row, a "Đóng" button. Overlay
          click closes; no zoom/download/prev-next — those aren't in the
          prototype's lightbox, which opens exactly the tile that was
          clicked and nothing else. */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-6 py-12"
        >
          <div
            ref={lightboxRef}
            role="dialog"
            aria-modal="true"
            aria-label={lightboxImg.name}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[900px] bg-slate-100 rounded-2xl p-6 flex flex-col gap-4 shadow-[0_2px_6px_rgba(2,2,2,0.14),0_12px_32px_rgba(2,2,2,0.10)]"
          >
            <div className="h-[420px] rounded-lg bg-surface border border-slate-200 flex items-center justify-center overflow-hidden">
              <img
                src={lightboxImg.url}
                alt={lightboxImg.name}
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <div className="flex items-center gap-4">
              <p className="text-sm text-slate-600 truncate">{lightboxImg.name}</p>
              <button
                onClick={() => setLightboxImg(null)}
                className="btn btn-outline !py-2 !px-4 text-sm ml-auto shrink-0"
              >
                {t('gallery.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
