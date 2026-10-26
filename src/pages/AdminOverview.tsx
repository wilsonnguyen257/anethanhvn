import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { subscribeJson } from '../lib/storage';
import { subscribeMessages, type ContactMessage } from '../lib/messages';
import { hasEventPassed, parseEventDate } from '../lib/timezone';
import type { Event } from '../types/content';
import type { RosterMember } from './AdminMinistries';

type ReflectionSummary = { id: string; status?: 'draft' | 'published' | 'deleted' };

export default function AdminOverview() {
  const { t, language } = useLanguage();
  const [events, setEvents] = useState<Event[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [reflectionCount, setReflectionCount] = useState(0);
  const [teamCount, setTeamCount] = useState(0);

  useEffect(() => {
    const unsubEvents = subscribeJson<Event[]>('events', (data) => setEvents(data || []), () => setEvents([]));
    const unsubMessages = subscribeMessages(setMessages, () => setMessages([]));
    const unsubReflections = subscribeJson<ReflectionSummary[]>(
      'reflections',
      (data) => setReflectionCount((data || []).filter((r) => (r.status || 'published') === 'published').length),
      () => setReflectionCount(0)
    );
    const unsubRoster = subscribeJson<RosterMember[]>('roster', (data) => setTeamCount((data || []).length), () => setTeamCount(0));
    return () => { unsubEvents(); unsubMessages(); unsubReflections(); unsubRoster(); };
  }, []);

  const upcoming = events
    .filter((e) => (e.status || 'published') === 'published' && !hasEventPassed(e.date, e.time || '11:59 PM'))
    .sort((a, b) => parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime());

  const pendingMessages = messages.filter((m) => m.status === 'pending');

  const stats = [
    { label: t('admin.upcoming_events_count'), value: upcoming.length, to: '/admin/events' },
    { label: t('admin.manage_reflections'), value: reflectionCount, to: '/admin/reflections' },
    { label: t('admin.pending_messages_count'), value: pendingMessages.length, to: '/admin/messages' },
    { label: t('admin.manage_ministries'), value: teamCount, to: '/admin/ministries' },
  ];

  return (
    <div className="container-xl py-6 md:py-8">
      <div className="flex items-center gap-4 flex-wrap mb-8">
        <h1 className="h2 !text-2xl">{t('admin.overview')}</h1>
        <div className="ml-auto flex gap-2">
          <Link to="/" className="btn btn-outline !py-2 !px-4 text-sm">{t('admin.view_site')}</Link>
          <Link to="/admin/events" className="btn btn-primary !py-2 !px-4 text-sm">{t('admin.post_event')}</Link>
        </div>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="card !p-5">
            <p className="text-xs text-slate-600">{s.label}</p>
            <p className="font-serif text-3xl font-bold text-slate-900 tabular-nums mt-1">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start mt-8">
        <div className="flex-[2_1_420px] min-w-0">
          <div className="flex items-center justify-between mb-3">
            <p className="eyebrow">{t('nav.events')}</p>
            <Link to="/admin/events" className="text-sm font-semibold text-brand-600 hover:underline">
              {t('admin.post_event')}
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {upcoming.length === 0 ? (
              <p className="text-slate-600 text-sm py-4">{t('events.no_events')}</p>
            ) : (
              upcoming.slice(0, 5).map((event) => (
                <div key={event.id} className="card flex items-center justify-between gap-3 !py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{event.name[language] || event.name.vi}</p>
                    <p className="font-mono text-xs text-slate-600 mt-0.5">
                      {parseEventDate(event.date).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex-[1_1_280px] min-w-0 w-full">
          <p className="eyebrow mb-3">{t('admin.pending_messages_count')}</p>
          <div className="card flex flex-col gap-4">
            {pendingMessages.length === 0 ? (
              <p className="text-slate-600 text-sm py-2">{t('admin.no_messages')}</p>
            ) : (
              pendingMessages.slice(0, 4).map((m) => (
                <Link key={m.id} to="/admin/messages" className="flex items-start gap-3 group">
                  <span className="w-8 h-8 rounded-full bg-surface border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
                    {m.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-brand-600 transition-colors">{m.name}</p>
                    <p className="text-xs text-slate-600 truncate">{m.context || m.message}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
