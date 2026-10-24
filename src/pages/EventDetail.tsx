import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEO from '../components/SEO';
import type { Event } from '../types/content';
import { subscribeJson } from '../lib/storage';
import EventCountdown from '../components/EventCountdown';
import { useLanguage } from '../contexts/LanguageContext';
import { hasEventPassed, parseEventDate, parseEventTime, MELBOURNE_TIMEZONE } from '../lib/timezone';
import { sanitizeRichHtml } from '../lib/sanitizeHtml';
import { buildEventJsonLd, SITE_URL } from '../lib/seo';
import { withLanguagePrefix } from '../lib/locale';
import { getGoogleDriveEmbedUrl, getYouTubeEmbedUrl, validateOptionalExternalUrl } from '../lib/validation';

// Builds a Google Calendar "quick add" link from an event's date/time/location.
// No backend needed — this is a URL template, not a stored registration.
//
// parseEventDate/setHours produce a Date whose *local getters* (getFullYear,
// getHours, ...) return the Melbourne wall-clock numbers — that's the
// convention the rest of lib/timezone.ts relies on. Formatting via
// toISOString() (UTC getters) would instead convert using the *viewer's*
// own timezone offset, silently shifting the event time for anyone browsing
// from outside Melbourne. So we format with local getters and tell Google
// Calendar which zone those numbers are in via `ctz`.
function buildGoogleCalendarUrl(name: string, date: string, time: string, location: string): string {
  const start = parseEventDate(date);
  if (time) {
    const { hours, minutes } = parseEventTime(time);
    start.setHours(hours, minutes, 0, 0);
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: name,
    dates: `${fmt(start)}/${fmt(end)}`,
    location: location || '',
    ctz: MELBOURNE_TIMEZONE,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useLanguage();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const unsub = subscribeJson<Event[]>(
      'events',
      (eventsData) => {
        const foundEvent = (eventsData || []).find((e) => e.id === id);
        if (foundEvent) {
          setEvent({
            id: foundEvent.id,
            name: { vi: foundEvent.name?.vi || '', en: foundEvent.name?.en || '' },
            date: foundEvent.date,
            time: foundEvent.time,
            location: foundEvent.location,
            content: foundEvent.content,
            thumbnail: foundEvent.thumbnail,
            thumbnailPath: foundEvent.thumbnailPath,
            thumbnailFull: foundEvent.thumbnailFull,
            facebookLink: foundEvent.facebookLink,
            youtubeLink: foundEvent.youtubeLink,
            driveLink: foundEvent.driveLink,
            status: foundEvent.status || 'published',
          });
          setNotFound(false);
        } else {
          setNotFound(true);
        }
        setLoading(false);
      },
      () => {
        setNotFound(true);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [id]);

  if (loading) {
    return (
      <div className="bg-surface min-h-screen">
        <div className="border-b border-slate-200 py-16 md:py-24">
          <div className="container-xl">
            <div className="animate-pulse flex flex-col items-center gap-6">
              <div className="h-6 w-32 bg-slate-200 rounded-full"></div>
              <div className="h-12 w-3/4 max-w-xl bg-slate-200 rounded-lg"></div>
              <div className="flex gap-6">
                <div className="h-14 w-40 bg-slate-200 rounded-xl"></div>
                <div className="h-14 w-32 bg-slate-200 rounded-xl"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center px-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">{t('events.not_found')}</h1>
          <p className="text-slate-600 mb-8 max-w-md">{t('events.not_found_desc')}</p>
          <Link to="/events" className="btn btn-primary">
            {t('events.back_to_events')}
          </Link>
        </div>
      </div>
    );
  }

  const isPast = hasEventPassed(event.date, event.time || '11:59 PM');
  const eventName = event.name[language] || event.name.vi;
  const eventContent = sanitizeRichHtml(event.content?.[language] || event.content?.vi || '');
  const facebookLink = validateOptionalExternalUrl(event.facebookLink || '', 'facebook').normalized;
  const youtubeLink = validateOptionalExternalUrl(event.youtubeLink || '', 'youtube').normalized;
  const driveLink = validateOptionalExternalUrl(event.driveLink || '', 'drive').normalized;
  const youtubeEmbedUrl = getYouTubeEmbedUrl(youtubeLink);
  const driveEmbedUrl = getGoogleDriveEmbedUrl(driveLink);
  const formattedDate = parseEventDate(event.date).toLocaleDateString(
    language === 'vi' ? 'vi-VN' : 'en-US',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  );

  return (
    <div className="bg-surface min-h-screen">
      <SEO
        title={eventName}
        description={eventName + ' - ' + formattedDate}
        image={event.thumbnailFull || event.thumbnail}
        jsonLd={buildEventJsonLd({
          name: eventName,
          description: eventContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300) || `${eventName} - ${formattedDate}`,
          date: event.date,
          time: event.time,
          location: event.location,
          image: event.thumbnailFull || event.thumbnail,
          url: `${SITE_URL}${withLanguagePrefix(`/events/${event.id}`, language)}`,
          language,
        })}
      />

      {/* Hero — centered, matching the site's symmetric public-page posture */}
      <section className="pt-10 pb-2 text-center">
        <div className="container-xl">
          <Link
            to="/events"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-8"
          >
            ‹ {t('events.back_to_events')}
          </Link>

          <div className="max-w-2xl mx-auto flex flex-col items-center gap-4">
            {!isPast ? (
              <span className="eyebrow justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {t('events.upcoming')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                {t('events.past')}
              </span>
            )}

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
              {eventName}
            </h1>

            <p className="text-sm text-slate-600">
              {formattedDate} · {event.time} · {event.location}
            </p>

            {(facebookLink || youtubeLink || driveLink) && (
              <div className="flex flex-wrap gap-3 justify-center mt-1">
                {facebookLink && (
                  <a href={facebookLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white bg-[#1877F2] hover:opacity-90 rounded-xl px-4 py-2 text-sm font-semibold transition-opacity">
                    Facebook
                  </a>
                )}
                {youtubeLink && (
                  <a href={youtubeLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white bg-[#FF0000] hover:opacity-90 rounded-xl px-4 py-2 text-sm font-semibold transition-opacity">
                    YouTube
                  </a>
                )}
                {driveLink && (
                  <a href={driveLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white bg-[#1FA463] hover:opacity-90 rounded-xl px-4 py-2 text-sm font-semibold transition-opacity">
                    Drive
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Content + registration */}
      <section className="py-12 md:py-16">
        <div className="container-xl">
          <div className="max-w-4xl mx-auto">
            {(event.thumbnailFull || event.thumbnail) && (
              <div className="mb-8 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                <img src={event.thumbnailFull || event.thumbnail} alt={eventName} className="w-full h-auto" loading="lazy" />
              </div>
            )}

            <div className="grid md:grid-cols-[1.5fr_1fr] gap-6 items-start">
              <div className="flex flex-col gap-6">
                {eventContent && (
                  <div className="card">
                    <div
                      className="prose max-w-none prose-p:text-slate-600 prose-headings:text-slate-900 prose-headings:font-sans prose-a:text-brand-600 prose-strong:text-slate-900"
                      dangerouslySetInnerHTML={{ __html: eventContent }}
                    />
                  </div>
                )}

                {youtubeEmbedUrl && (
                  <div className="card">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">{t('events.video')}</h2>
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

                {driveEmbedUrl && (
                  <div className="card">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">{t('events.video')}</h2>
                    <div className="relative pt-[56.25%] rounded-xl overflow-hidden bg-slate-900">
                      <iframe src={driveEmbedUrl} className="absolute inset-0 w-full h-full" allow="autoplay" title="Google Drive Video"></iframe>
                    </div>
                  </div>
                )}
              </div>

              {/* Ghi danh — a lightweight action card, not a form the site can't
                  yet store: registration hands off to Liên lạc so a real
                  person confirms it, until a dedicated registrations
                  collection ships alongside the admin message inbox. */}
              <div className="card flex flex-col gap-4">
                {!isPast && (
                  <div className="pb-4 border-b border-slate-200">
                    <EventCountdown eventDate={event.date} eventTime={event.time} />
                  </div>
                )}
                <p className="eyebrow">{t('events.details')}</p>
                {!isPast && (
                  <Link to={`/contact?event=${encodeURIComponent(eventName)}`} className="btn btn-primary w-full justify-center">
                    {t('events.view_details')}
                  </Link>
                )}
                <a
                  href={buildGoogleCalendarUrl(eventName, event.date, event.time || '', event.location || '')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline w-full justify-center"
                >
                  + Google Calendar
                </a>
              </div>
            </div>

            <div className="text-center pt-10">
              <Link to="/events" className="btn btn-outline">
                {t('events.back_to_events')}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
