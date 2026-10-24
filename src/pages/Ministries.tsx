import { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import SEO from '../components/SEO';
import { subscribeJson } from '../lib/storage';
import type { RosterMember } from './AdminMinistries';

// One icon treatment for every ministry — no per-card accent color. The
// rainbow-per-card palette this page used to have (blue/purple/rose/emerald/
// amber/indigo) is exactly the "accent inflation" DESIGN.md's Do's and
// Don'ts warns against; a flat grid where every card is visually identical
// is also what the wireframe (2f) calls for.
const ministries = [
  {
    key: 'family',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    key: 'liturgy',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    key: 'music',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
  },
  {
    key: 'charity',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    key: 'youth',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    key: 'evangelization',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
  },
];

export default function Ministries() {
  const { t } = useLanguage();
  const [roster, setRoster] = useState<RosterMember[]>([]);

  useEffect(() => {
    const unsub = subscribeJson<RosterMember[]>(
      'roster',
      (data) => setRoster((data || []).filter((m) => m.visible).sort((a, b) => a.order - b.order)),
      () => setRoster([])
    );
    return unsub;
  }, []);

  return (
    <div className="bg-surface">
      <SEO title={t('ministries.title')} description={t('home.description')} />
      <section className="pt-16 pb-2 text-center">
        <div className="container-xl">
          <h1 className="h1 !text-4xl md:!text-5xl">{t('ministries.title')}</h1>
          <p className="mt-4 text-slate-600 max-w-lg mx-auto leading-relaxed">{t('ministries.description')}</p>
        </div>
      </section>

      {/* Ban mục vụ — the parish council roster. A flat grid, every card the
          same: no first slot, no leader row (matches wireframe 2f). */}
      {roster.length > 0 && (
        <section className="pt-4 pb-4">
          <div className="container-xl">
            <p className="eyebrow mb-5">{t('nav.ministries')}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {roster.map((member) => (
                <div key={member.id} className="card flex flex-col items-center text-center gap-2">
                  <span className="w-14 h-14 rounded-full bg-surface border border-slate-200 overflow-hidden flex items-center justify-center text-sm font-semibold text-slate-600">
                    {member.photoUrl ? (
                      <img src={member.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      member.name.slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900">{member.name}</h3>
                  <p className="nums-lining text-xs text-slate-600">{member.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Ministries — a flat grid, every card the same. No first slot, no
          leader row (DESIGN.md § Components, matching wireframe 2f). */}
      <section className="pt-4 pb-16">
        <div className="container-xl">
          {roster.length > 0 && <p className="eyebrow mb-5">{t('ministries.title')}</p>}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ministries.map((ministry) => (
              <div key={ministry.key} className="card">
                <div className="w-12 h-12 rounded-full bg-surface border border-slate-200 flex items-center justify-center mb-5 text-brand-600">
                  {ministry.icon}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {t(`ministries.${ministry.key}`)}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">
                  {t(`ministries.${ministry.key}_desc`)}
                </p>
                <ul className="space-y-2 pt-4 border-t border-slate-200">
                  {[1, 2, 3].map((num) => (
                    <li key={num} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <span className="text-brand-500 mt-0.5">·</span>
                      {t(`ministries.${ministry.key}_activity_${num}`)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <a href="mailto:anethanhvn@gmail.com" className="btn btn-primary">
              {t('ministries.get_involved')}
            </a>
          </div>
        </div>
      </section>

      {/* Safeguarding Policy */}
      <section className="py-12 bg-slate-100 border-t border-slate-200">
        <div className="container-xl">
          <div className="card flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <p className="eyebrow mb-4">{t('ministries.safeguarding_title')}</p>
              <h2 className="text-2xl font-serif font-bold text-slate-900 mb-4">
                {t('ministries.safeguarding_heading')}
              </h2>
              <p className="text-slate-600 mb-6 leading-relaxed">
                {t('ministries.safeguarding_desc')}
              </p>
              <a
                href="/documents/Safeguarding-and-Wellbeing-of-Children-and-Young-People-SWCYP-Policy-v2.0.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                {t('ministries.download_policy')}
              </a>
            </div>
            <div className="w-full md:w-1/3 flex justify-center">
              <a
                href="/documents/Safeguarding-and-Wellbeing-of-Children-and-Young-People-SWCYP-Policy-v2.0.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="relative w-40 h-52 bg-surface rounded-xl border border-slate-200 flex items-center justify-center group cursor-pointer"
              >
                <svg className="w-16 h-16 text-slate-300 group-hover:text-brand-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-20 bg-slate-900">
        <div className="container-xl text-center">
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-surface mb-4">{t('ministries.get_involved')}</h2>
          <p className="text-slate-400 max-w-xl mx-auto mb-8 leading-relaxed">
            {t('ministries.get_involved_desc')}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="tel:0422-400-116" className="btn bg-surface text-slate-900 hover:bg-slate-100">
              {t('ministries.call_us')}
            </a>
            <a href="mailto:anethanhvn@gmail.com" className="btn border border-white/20 text-surface hover:bg-white/10">
              {t('ministries.email_us')}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
