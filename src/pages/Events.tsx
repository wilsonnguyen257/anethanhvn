import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import type { Event } from "../types/content";
import { subscribeJson } from "../lib/storage";
import { useLanguage } from "../contexts/LanguageContext";
import { hasEventPassed, parseEventDate } from "../lib/timezone";
import { CHURCH_INFO } from "../lib/constants";

// Strip HTML for the two-line body preview inside each event card.
const stripHtml = (html: string): string => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

export default function Events() {
  const { t, language } = useLanguage();
  const [events, setEvents] = useState<Event[]>([]);
  const [eventTab, setEventTab] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    const unsub = subscribeJson<Event[]>(
      'events',
      (eventsData) => {
        const mapped: Event[] = (eventsData || []).map((d) => {
          // Ensure both languages have content
          const nameVi = d.name?.vi || d.name?.en || '';
          const nameEn = d.name?.en || d.name?.vi || '';
          const contentVi = d.content?.vi || d.content?.en || '';
          const contentEn = d.content?.en || d.content?.vi || '';

          return {
            id: d.id,
            name: { vi: nameVi, en: nameEn },
            date: d.date,
            time: d.time,
            location: d.location,
            content: d.content ? { vi: contentVi, en: contentEn } : undefined,
            thumbnail: d.thumbnail,
            thumbnailPath: d.thumbnailPath,
            facebookLink: d.facebookLink,
            youtubeLink: d.youtubeLink,
            driveLink: d.driveLink,
            status: d.status || 'published',
          };
        }).filter(e => e.status === 'published');
        setEvents(mapped);
      }
    );
    return () => { unsub(); };
  }, []);

  const now = useMemo(() => new Date(), []);

  const upcomingEvents = useMemo(() => {
    return events.filter(e => {
      try {
        return !hasEventPassed(e.date, e.time || '11:59 PM');
      } catch {
        return parseEventDate(e.date) >= now;
      }
    }).sort((a, b) => parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime());
  }, [events, now]);

  const pastEvents = useMemo(() => {
    return events.filter(e => {
      try {
        return hasEventPassed(e.date, e.time || '11:59 PM');
      } catch {
        return parseEventDate(e.date) < now;
      }
    }).sort((a, b) => parseEventDate(b.date).getTime() - parseEventDate(a.date).getTime());
  }, [events, now]);

  const filteredEvents = eventTab === 'upcoming' ? upcomingEvents : pastEvents;

  return (
    <div className="bg-surface">
      <SEO
        title={t('events.title')}
        description={t('events.subtitle')}
      />

      <section className="pt-16 pb-10 text-center">
        <div className="container-xl">
          <h1 className="h1 !text-4xl md:!text-5xl">{t('events.title')}</h1>
          <p className="mt-4 text-slate-600 max-w-lg mx-auto leading-relaxed">{t('events.subtitle')}</p>
        </div>
      </section>

      {/* Two columns per the prototype: a Mass-info card on the left,
          the filterable event calendar on the right. */}
      <section className="pb-20">
        <div className="container-xl flex flex-col md:flex-row gap-8 items-start">
          {/* Giờ lễ */}
          <div className="card flex-[1_1_340px] flex flex-col gap-4">
            <p className="eyebrow">{t('home.mass_schedule_subtitle')}</p>
            <div className="flex items-baseline justify-between pb-3.5 border-b border-slate-200">
              <span className="font-serif text-xl font-bold text-slate-900">{t('home.sunday')}</span>
              <span className="font-serif text-xl font-bold text-slate-900 nums-lining">{CHURCH_INFO.MASS_RANGE[language]}</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{CHURCH_INFO.ADDRESS}</p>
            <div className="rounded-xl overflow-hidden border border-slate-200 h-40">
              <iframe
                src={CHURCH_INFO.MAPS_EMBED_URL}
                title="Church location"
                className="w-full h-full"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
            <a href={CHURCH_INFO.MAPS_LINK} target="_blank" rel="noopener noreferrer" className="text-brand-600 font-semibold text-sm hover:underline self-start">
              {t('home.directions')}
            </a>
          </div>

          {/* Sự kiện */}
          <div className="flex-[2_1_520px] min-w-0 flex flex-col gap-5">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="eyebrow">{t('nav.events')}</p>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  aria-pressed={eventTab === 'upcoming'}
                  onClick={() => setEventTab('upcoming')}
                  className={`btn !py-2 !px-4 text-sm ${eventTab === 'upcoming' ? 'btn-primary' : 'btn-outline'}`}
                >
                  {t('events.upcoming')}
                </button>
                <button
                  type="button"
                  aria-pressed={eventTab === 'past'}
                  onClick={() => setEventTab('past')}
                  className={`btn !py-2 !px-4 text-sm ${eventTab === 'past' ? 'btn-primary' : 'btn-outline'}`}
                >
                  {t('events.past')}
                </button>
              </div>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-600 text-sm">
                {t('events.no_upcoming')}
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {filteredEvents.map((event) => (
                  <Link
                    key={event.id}
                    to={`/events/${event.id}`}
                    className="card !p-0 overflow-hidden group flex flex-col"
                  >
                    {event.thumbnail && (
                      <div className="h-40 overflow-hidden bg-slate-200 shrink-0">
                        <img
                          src={event.thumbnail || event.thumbnailPath}
                          alt={event.name[language] || event.name.vi}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    )}
                    <div className="p-5 flex flex-col gap-2 flex-1">
                      <h3 className="font-serif text-lg font-bold text-slate-900 group-hover:text-brand-600 transition-colors leading-snug">
                        {event.name[language] || event.name.vi}
                      </h3>
                      <p className="nums-lining text-xs text-slate-600">
                        {parseEventDate(event.date).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'short', day: '2-digit', month: 'short' })} · {event.time} · {event.location}
                      </p>
                      {event.content && (
                        <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">
                          {stripHtml(event.content[language] || event.content.vi)}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
