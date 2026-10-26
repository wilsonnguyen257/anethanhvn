import { useLanguage } from '../contexts/LanguageContext';
import SEO from '../components/SEO';

// This page intentionally has no "$20 / $50 / $100 → Continue" checkout flow:
// there is no payment processor wired up behind it, and a button that looks
// like it takes a donation but doesn't would be worse than not having one.
// Every action here — cash, bank transfer, or a direct call — hands off to a
// real person. Online giving can be added once a processor is provisioned.
export default function Give() {
  const { t } = useLanguage();

  return (
    <div className="bg-surface">
      <SEO title={t('give.title')} description={t('give.subtitle')} />

      <section className="pt-16 pb-2 text-center">
        <div className="container-xl">
          <h1 className="h1 !text-4xl md:!text-5xl">{t('give.title')}</h1>
          <p className="mt-4 text-slate-600 max-w-lg mx-auto leading-relaxed">{t('give.subtitle')}</p>
        </div>
        {/* The one page where gold leads — Ủng hộ is the Give action, so
            that's still its one job (DESIGN.md § Colors). */}
        <div className="mx-auto w-0.5 bg-accent-400 mt-10" style={{ height: '48px' }} />
      </section>

      <section className="py-12">
        <div className="container-xl max-w-4xl mx-auto grid gap-6 md:grid-cols-2 items-start">
          {/* Cash — the primary, most-used option today */}
          <div className="card flex flex-col gap-4 md:col-span-2">
            <p className="eyebrow">{t('give.cash_donation')}</p>
            <h2 className="text-xl font-serif font-bold text-slate-900">{t('give.cash_donation_title')}</h2>
            <p className="text-slate-600">{t('give.cash_description')}</p>
            <ul className="space-y-2.5">
              {[t('give.sunday_mass'), t('give.special_occasions'), t('give.meet_committee')].map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {/* Bank transfer */}
          <div className="card flex flex-col gap-3">
            <p className="eyebrow">{t('give.bank_transfer')}</p>
            <h3 className="text-lg font-semibold text-slate-900">{t('give.bank_transfer_title')}</h3>
            <p className="text-sm text-slate-600">{t('give.bank_transfer_desc')}</p>
            <div className="text-sm divide-y divide-slate-200 border-t border-b border-slate-200 mt-1">
              <div className="flex justify-between py-2.5"><span className="text-slate-600">{t('give.account_name')}</span><span className="font-semibold text-slate-900">—</span></div>
              <div className="flex justify-between py-2.5"><span className="text-slate-600">{t('give.bsb')}</span><span className="nums-lining font-semibold text-slate-900">—</span></div>
              <div className="flex justify-between py-2.5"><span className="text-slate-600">{t('give.account_number')}</span><span className="nums-lining font-semibold text-slate-900">—</span></div>
            </div>
            <p className="text-xs text-slate-600">{t('give.reference_note')}</p>
          </div>

          {/* Contact */}
          <div className="card flex flex-col gap-3">
            <p className="eyebrow">{t('give.contact_title')}</p>
            <p className="text-sm text-slate-600">{t('give.contact_description')}</p>
            <div className="flex flex-wrap gap-3 mt-1">
              <a href="tel:0422-400-116" className="btn-give rounded-xl px-4 py-2.5 text-sm font-semibold">
                0422-400-116
              </a>
              <a href="mailto:anethanhvn@gmail.com" className="btn btn-outline">
                Email
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="container-xl max-w-2xl mx-auto text-center">
          <h2 className="text-xl font-serif font-bold text-slate-900 mb-3">{t('give.thank_you_title')}</h2>
          <p className="text-slate-600 leading-relaxed">{t('give.thank_you_message')}</p>
        </div>
      </section>
    </div>
  );
}
