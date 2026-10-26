import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import SEO from '../components/SEO';
import { CHURCH_INFO } from '../lib/constants';
import { submitMessage } from '../lib/messages';

const MIN_FILL_MS = 3000;
const COOLDOWN_MS = 30_000;
const LAST_SENT_KEY = 'contact:last-sent';

export default function Contact() {
  const { t, language } = useLanguage();
  const [honeypot, setHoneypot] = useState('');
  const openedAt = useRef(Date.now());
  const [searchParams] = useSearchParams();
  const eventContext = searchParams.get('event');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('register');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topicOptions = [
    { value: 'register', label: t('contact.topic_register') },
    { value: 'mass-intention', label: t('contact.topic_mass_intention') },
    { value: 'other', label: t('contact.topic_other') },
  ];

  // Only re-run when eventContext changes — depending on `language` too would
  // overwrite whatever the visitor has already typed every time they toggle
  // the language switcher, silently discarding their draft message.
  const languageRef = useRef(language);
  languageRef.current = language;
  useEffect(() => {
    if (eventContext) {
      setMessage(
        languageRef.current === 'vi'
          ? `Tôi muốn ghi danh tham gia: ${eventContext}\n\n`
          : `I'd like to register for: ${eventContext}\n\n`
      );
    }
  }, [eventContext]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Bots fill every field, including the hidden one. Pretend success so they
    // get no signal to adapt to; a person can't trip this.
    if (honeypot !== '') {
      setSent(true);
      return;
    }
    // A submit within seconds of opening the page is almost never a person.
    // Show an honest error (not a fake success) in case autofill was just fast.
    if (Date.now() - openedAt.current < MIN_FILL_MS) {
      setError(t('contact.send_error'));
      return;
    }

    // Light client-side throttle against accidental or repeated submits.
    try {
      const last = Number(localStorage.getItem(LAST_SENT_KEY) || 0);
      if (Date.now() - last < COOLDOWN_MS) {
        setError(t('contact.send_error'));
        return;
      }
    } catch {
      /* storage unavailable; skip the throttle */
    }

    setSubmitting(true);
    try {
      const topicLabel = topicOptions.find((o) => o.value === topic)?.label;
      await submitMessage({
        name,
        email,
        message,
        // firestore.rules caps context at 500 characters
        context: (eventContext ? `Re: ${eventContext}` : topicLabel)?.slice(0, 450),
      });
      try {
        localStorage.setItem(LAST_SENT_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
      setSent(true);
      setName('');
      setEmail('');
      setMessage('');
    } catch {
      setError(t('contact.send_error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-surface">
      <SEO
        title={t('contact.title')}
        description={t('contact.description')}
      />

      <section className="pt-16 pb-2 text-center">
        <div className="container-xl">
          <h1 className="h1 !text-4xl md:!text-5xl">{t('contact.title')}</h1>
          <p className="mt-4 text-slate-600 max-w-lg mx-auto">{t('contact.description')}</p>
        </div>
      </section>

      {/* Two columns per the prototype: the message form on the left,
          address/map info on the right — and the form leads on mobile too. */}
      <section className="py-12">
        <div className="container-xl">
          <div className="max-w-4xl mx-auto grid gap-6 md:grid-cols-[1.1fr_1fr] items-start">
            <div className="card">
              <p className="eyebrow mb-4">{t('contact.send_message')}</p>
              {sent ? (
                <div role="status" className="flex flex-col items-center text-center gap-3 py-8">
                  <span className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
                  <p className="font-semibold text-slate-900">{t('contact.success_message')}</p>
                  <button onClick={() => setSent(false)} className="text-sm text-brand-600 font-semibold hover:underline">
                    {t('contact.send_another')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {/* Honeypot: invisible to people and assistive tech, tempting to bots */}
                  <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                    <label htmlFor="contact-website">Website</label>
                    <input
                      id="contact-website"
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-name" className="block text-sm font-semibold text-slate-700 mb-1.5">{t('contact.name')}</label>
                    <input
                      id="contact-name"
                      type="text"
                      autoComplete="name"
                      required
                      maxLength={199}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-surface text-slate-900 focus:ring-2 focus:ring-brand-600 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="block text-sm font-semibold text-slate-700 mb-1.5">{t('contact.email')}</label>
                    <input
                      id="contact-email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={319}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-surface text-slate-900 focus:ring-2 focus:ring-brand-600 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-topic" className="block text-sm font-semibold text-slate-700 mb-1.5">{t('contact.subject')}</label>
                    <select
                      id="contact-topic"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-surface text-slate-900 focus:ring-2 focus:ring-brand-600 focus:border-transparent cursor-pointer"
                    >
                      {topicOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="contact-message" className="block text-sm font-semibold text-slate-700 mb-1.5">{t('contact.message')}</label>
                    <textarea
                      id="contact-message"
                      required
                      rows={5}
                      maxLength={4999}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-surface text-slate-900 focus:ring-2 focus:ring-brand-600 focus:border-transparent resize-none"
                    />
                  </div>
                  {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                  <button type="submit" disabled={submitting} className="btn btn-primary w-full justify-center">
                    {submitting ? t('contact.sending') : t('contact.send_button')}
                  </button>
                </form>
              )}
            </div>

            <div className="flex flex-col gap-6">
              <div className="card flex flex-col gap-2">
                <p className="eyebrow">{t('contact.address')}</p>
                <p className="text-sm text-slate-600 leading-relaxed">{CHURCH_INFO.ADDRESS}</p>
                <p className="text-sm text-slate-600 nums-lining">{t('home.sunday')} {CHURCH_INFO.MASS_RANGE[language]}</p>
                <div className="flex flex-col gap-1 mt-3 pt-3 border-t border-slate-200">
                  <a href={`tel:${CHURCH_INFO.PHONE}`} className="text-sm font-semibold text-brand-600 hover:underline">{CHURCH_INFO.PHONE}</a>
                  <a href={`mailto:${CHURCH_INFO.EMAIL}`} className="text-sm font-semibold text-brand-600 hover:underline break-all">{CHURCH_INFO.EMAIL}</a>
                </div>
                <a
                  href={CHURCH_INFO.MAPS_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline self-start mt-3"
                >
                  {t('contact.open_map')}
                </a>
              </div>

              <div className="rounded-2xl overflow-hidden border border-slate-200 h-[260px]">
                <iframe
                  src={CHURCH_INFO.MAPS_EMBED_URL}
                  title="Church location"
                  className="w-full h-full"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
              </div>

              <div className="card">
                <h3 className="text-base font-semibold text-slate-900 mb-4">{t('contact.connect_with_us')}</h3>
                <div className="flex gap-2">
                  <a
                    href={CHURCH_INFO.FACEBOOK_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-surface border border-slate-200 flex items-center justify-center text-slate-600 hover:text-brand-600 hover:border-brand-200 transition-colors"
                    aria-label="Facebook"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
