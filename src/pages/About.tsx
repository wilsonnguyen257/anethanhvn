import { useLanguage } from '../contexts/LanguageContext';
import SEO from '../components/SEO';

// One icon treatment throughout — no per-card accent color. A rainbow of
// blue/purple/rose/amber/emerald badges is exactly the "accent inflation"
// DESIGN.md's Do's and Don'ts warns against; every icon here sits in a plain
// rice-paper roundel and takes lacquer red, matching Ministries.tsx.
export default function About() {
  const { t } = useLanguage();

  return (
    <div className="bg-surface">
      <SEO
        title={t('about.title')}
        description={t('about.welcome')}
      />

      <section className="pt-16 pb-2 text-center">
        <div className="container-xl">
          <h1 className="h1 !text-4xl md:!text-5xl">{t('about.title')}</h1>
          <p className="mt-4 text-slate-600 max-w-xl mx-auto leading-relaxed">{t('about.welcome')}</p>
        </div>
      </section>

      {/* History Section with Timeline */}
      <section className="py-20">
        <div className="container-xl">
          <h2 className="h2 text-center mb-12">{t('about.history_title')}</h2>
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" aria-hidden="true"></div>

              <ol>
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <li key={num} className="relative pl-10 pb-10 last:pb-0">
                  <span className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full bg-brand-600 ring-4 ring-surface" aria-hidden="true"></span>
                  <p className="text-sm font-semibold tracking-wide text-brand-600">{t(`about.history_${num}_date`)}</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">{t(`about.history_${num}_title`)}</h3>
                  <p className="mt-2 text-slate-600 leading-relaxed">{t(`about.history_${num}_body`)}</p>
                </li>
              ))}
              </ol>
            </div>

            <blockquote className="mt-14 border-l-2 border-brand-600 pl-6">
              <p className="font-serif text-lg md:text-xl text-slate-800 leading-relaxed">{t('about.history_closing')}</p>
              <footer className="mt-4 text-sm text-slate-600">
                {t('about.history_source')}{' '}
                <a
                  href="/documents/So-Luoc-Lich-Su-CD-Ane-Thanh-Oct-2026.docx"
                  download
                  className="text-brand-600 underline underline-offset-2 hover:text-brand-700"
                >
                  {t('about.history_download')}
                </a>
              </footer>
            </blockquote>
          </div>
        </div>
      </section>

      {/* Mission & Vision Section */}
      <section className="bg-slate-100 border-y border-slate-200 py-20">
        <div className="container-xl">
          <h2 className="h2 text-center mb-12">{t('about.mission_vision')}</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {/* Mission Card */}
            <div className="card !bg-surface !p-8">
              <div className="w-14 h-14 rounded-full bg-surface border border-slate-200 flex items-center justify-center mb-6 text-brand-600">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-6">{t('about.mission')}</h3>
              <ul className="space-y-3">
                {[1, 2, 3].map((num) => (
                  <li key={num} className="flex items-start gap-2.5 text-slate-700">
                    <span className="text-brand-500 mt-0.5">·</span>
                    <span>{t(`about.mission_${num}`)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Vision Card */}
            <div className="card !bg-surface !p-8">
              <div className="w-14 h-14 rounded-full bg-surface border border-slate-200 flex items-center justify-center mb-6 text-brand-600">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-6">{t('about.vision')}</h3>
              <ul className="space-y-3">
                {[1, 2, 3].map((num) => (
                  <li key={num} className="flex items-start gap-2.5 text-slate-700">
                    <span className="text-brand-500 mt-0.5">·</span>
                    <span>{t(`about.vision_${num}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Activities Section */}
      <section className="py-20">
        <div className="container-xl">
          <h2 className="h2 text-center mb-4">{t('about.activities_title')}</h2>
          <p className="text-center text-slate-600 max-w-2xl mx-auto mb-12">
            {t('about.activities_desc')}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(['liturgy', 'education', 'community'] as const).map((key) => (
              <div key={key} className="card">
                <div className="w-12 h-12 rounded-full bg-surface border border-slate-200 flex items-center justify-center mb-5 text-brand-600">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {key === 'liturgy' && (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    )}
                    {key === 'education' && (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    )}
                    {key === 'community' && (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    )}
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">{t(`about.${key}`)}</h3>
                <ul className="space-y-2.5 pt-1">
                  {[1, 2, 3].map((num) => (
                    <li key={num} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <span className="text-brand-500 mt-0.5">·</span>
                      <span>{t(`about.${key}_${num}`)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Leadership Section */}
      <section className="bg-slate-100 border-y border-slate-200 py-20">
        <div className="container-xl">
          <h2 className="h2 text-center mb-12">{t('about.leadership')}</h2>
          <div className="max-w-4xl mx-auto card !bg-surface !p-8">
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 w-14 h-14 rounded-full bg-surface border border-slate-200 flex items-center justify-center text-brand-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <p className="text-lg text-slate-700 leading-relaxed">
                  {t('about.leadership_desc')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact CTA Section */}
      <section className="py-20 bg-slate-900">
        <div className="container-xl text-center">
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-surface mb-4">{t('about.join_title')}</h2>
          <p className="text-slate-400 max-w-xl mx-auto mb-8 leading-relaxed">
            {t('about.join_desc')}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="tel:0422-400-116" className="btn bg-surface text-slate-900 hover:bg-slate-100">
              {t('about.call')}
            </a>
            <a href="mailto:anethanhvn@gmail.com" className="btn border border-white/20 text-surface hover:bg-white/10">
              {t('about.email')}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
