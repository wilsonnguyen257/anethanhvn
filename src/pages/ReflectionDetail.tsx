import { useParams, useNavigate, Link } from "react-router-dom";
import SEO from "../components/SEO";
import { useEffect, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { subscribeJson } from "../lib/storage";
import ReflectionCover from "../components/ReflectionCover";
import { sanitizeRichHtml } from "../lib/sanitizeHtml";
import { getFacebookPluginUrl, getGoogleDriveEmbedUrl, getYouTubeEmbedUrl, validateOptionalExternalUrl } from "../lib/validation";

type Reflection = {
  title: {
    vi: string;
    en: string;
  };
  content: {
    vi: string;
    en: string;
  };
  date?: string;
  author?: string;
  thumbnail?: string;
  thumbnailFull?: string;
  facebookLink?: string;
  youtubeLink?: string;
  driveLink?: string;
};

export default function ReflectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [reflection, setReflection] = useState<Reflection | null>(null);
  // Neighbours in the published, date-sorted list — for the "← Bài trước /
  // Bài sau →" footer row the prototype calls for.
  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    type Item = Reflection & { id: string; status?: 'draft' | 'published' };
    const unsub = subscribeJson<Item[]>(
      'reflections',
      (items) => {
        const published = (items || [])
          .filter((it) => (it.status || 'published') === 'published')
          .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
        const index = published.findIndex((r) => r.id === id);
        const found = index !== -1 ? published[index] : undefined;
        if (!found) {
          // An empty list usually means data is still loading; only redirect once we know the id is missing.
          if (published.length > 0) navigate("/reflections");
          return;
        }
        const mapped: Reflection = {
          // Ensure both languages have content
          title: {
            vi: found.title?.vi || found.title?.en || '',
            en: found.title?.en || found.title?.vi || ''
          },
          content: {
            vi: found.content?.vi || found.content?.en || '',
            en: found.content?.en || found.content?.vi || ''
          },
          date: found.date,
          author: found.author,
          thumbnail: found.thumbnail,
          thumbnailFull: found.thumbnailFull,
          facebookLink: found.facebookLink,
          youtubeLink: found.youtubeLink,
          driveLink: found.driveLink,
        };
        setReflection(mapped);
        // Newest-first order: "previous" (older) is the next index, "next"
        // (newer) is the prior index.
        setPrevId(index < published.length - 1 ? published[index + 1].id : null);
        setNextId(index > 0 ? published[index - 1].id : null);
      },
      (e) => {
        console.error('Failed to load reflection detail:', e);
        navigate("/reflections");
      }
    );
    return () => { unsub(); };
  }, [id, navigate]);

  if (!reflection) return null;

  const title = typeof reflection.title === 'string' ? reflection.title : (reflection.title[language] || reflection.title.vi);
  const content = typeof reflection.content === 'string' ? reflection.content : (reflection.content[language] || reflection.content.vi);
  const safeContent = sanitizeRichHtml(content);
  const facebookLink = validateOptionalExternalUrl(reflection.facebookLink || '', 'facebook').normalized;
  const youtubeLink = validateOptionalExternalUrl(reflection.youtubeLink || '', 'youtube').normalized;
  const driveLink = validateOptionalExternalUrl(reflection.driveLink || '', 'drive').normalized;
  const facebookPluginUrl = getFacebookPluginUrl(facebookLink);
  const youtubeEmbedUrl = getYouTubeEmbedUrl(youtubeLink);
  const driveEmbedUrl = getGoogleDriveEmbedUrl(driveLink);

  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  return (
    <div className="bg-surface min-h-screen">
      <SEO
        title={title}
        description={stripHtml(safeContent).slice(0, 160) + '...'}
      />
      {/* Header — centered, measure-capped: nothing in the margins to pull
          the eye out of the text (see DESIGN.md § Layout). */}
      <section className="pt-10 pb-2 text-center">
        <div className="container-xl">
          <button
            onClick={() => navigate("/reflections")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-8"
          >
            ‹ {t('reflections.back_to_list')}
          </button>

          <div className="measure-prose mx-auto flex flex-col items-center gap-3">
            <p className="eyebrow justify-center">
              {reflection.date || t('reflections.recently')}
            </p>
            <h1 className="text-2xl md:text-3xl font-serif font-bold leading-snug">
              {title}
            </h1>
            {reflection.author && <p className="text-sm text-slate-600">{reflection.author}</p>}

            {(facebookLink || driveLink) && (
              <div className="flex flex-wrap gap-3 justify-center mt-1">
                {facebookLink && (
                  <a href={facebookLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white bg-[#1877F2] hover:opacity-90 rounded-xl px-3 py-1.5 text-sm font-semibold transition-opacity">
                    Facebook
                  </a>
                )}
                {driveLink && (
                  <a href={driveLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white bg-[#1FA463] hover:opacity-90 rounded-xl px-3 py-1.5 text-sm font-semibold transition-opacity">
                    Drive
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-12">
        <div className="container-xl">
          {!(reflection.thumbnailFull || reflection.thumbnail) && (
            <ReflectionCover
              content={typeof reflection.content === 'string' ? reflection.content : reflection.content.vi}
              date={reflection.date}
              size="banner"
              className="measure-prose mx-auto mb-8 h-[200px] sm:h-[240px] rounded-2xl"
            />
          )}
          {(reflection.thumbnailFull || reflection.thumbnail) && (
            <div className="measure-prose mx-auto relative mb-8 h-[240px] sm:h-[320px] rounded-2xl overflow-hidden bg-slate-800">
              <div
                className="absolute inset-0 bg-cover bg-center scale-110 blur-2xl opacity-50"
                style={{ backgroundImage: `url(${reflection.thumbnailFull || reflection.thumbnail})` }}
                aria-hidden="true"
              />
              <img
                src={reflection.thumbnailFull || reflection.thumbnail}
                alt={title}
                loading="lazy"
                className="relative mx-auto h-full w-auto max-w-full object-contain"
              />
            </div>
          )}

          <div className="measure-prose mx-auto">
            <div
              className="prose prose-headings:font-sans prose-headings:text-slate-900 prose-p:text-slate-700 prose-p:leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: safeContent
              }}
            />

            {youtubeEmbedUrl && (
              <div className="mt-8">
                <div className="relative pt-[56.25%] rounded-xl overflow-hidden bg-slate-900">
                   <iframe
                     className="absolute inset-0 w-full h-full"
                     src={youtubeEmbedUrl}
                     title="YouTube video player"
                     allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                     allowFullScreen
                   ></iframe>
                </div>
              </div>
            )}

            {facebookPluginUrl && (
              <div className="mt-8 flex justify-center">
                <iframe
                  src={facebookPluginUrl}
                  width="500"
                  height={facebookLink.includes('/videos/') || facebookLink.includes('/watch') || facebookLink.includes('fb.watch') ? "300" : "600"}
                  style={{border:'none', overflow:'hidden'}}
                  scrolling="no"
                  frameBorder="0"
                  allowFullScreen={true}
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                  className="rounded-xl max-w-full bg-surface"
                ></iframe>
              </div>
            )}

            {driveEmbedUrl && (
              <div className="mt-8">
                <div className="relative pt-[56.25%] rounded-xl overflow-hidden bg-slate-900">
                  <iframe
                    src={driveEmbedUrl}
                    className="absolute inset-0 w-full h-full"
                    allow="autoplay"
                    title="Google Drive Video"
                  ></iframe>
                </div>
              </div>
            )}

            {/* Footer row — two icon roundels (print, share) beside the
                prev/next post links, above a hairline, per the prototype. */}
            <div className="flex items-center gap-3 flex-wrap mt-10 pt-6 border-t border-slate-200">
              <button
                onClick={() => window.print()}
                aria-label={t('reflections.print')}
                title={t('reflections.print')}
                className="w-9 h-9 rounded-full bg-surface border border-slate-200 flex items-center justify-center text-slate-600 hover:text-brand-600 hover:border-brand-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                </svg>
              </button>
              <button
                onClick={() => {
                  if (navigator.share) {
                    void navigator.share({ title, url: window.location.href });
                  } else {
                    void navigator.clipboard.writeText(window.location.href);
                  }
                }}
                aria-label={t('reflections.share')}
                title={t('reflections.share')}
                className="w-9 h-9 rounded-full bg-surface border border-slate-200 flex items-center justify-center text-slate-600 hover:text-brand-600 hover:border-brand-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
              </button>

              <div className="ml-auto flex gap-5 text-sm font-semibold">
                {prevId ? (
                  <Link to={`/reflections/${prevId}`} className="text-slate-700 hover:text-brand-600 transition-colors">
                    {t('reflections.prev_post')}
                  </Link>
                ) : <span />}
                {nextId && (
                  <Link to={`/reflections/${nextId}`} className="text-slate-700 hover:text-brand-600 transition-colors">
                    {t('reflections.next_post')}
                  </Link>
                )}
              </div>
            </div>

            <div className="text-center mt-8">
              <button onClick={() => navigate("/reflections")} className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
                ‹ {t('reflections.back_to_list')}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
