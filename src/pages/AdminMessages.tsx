import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { subscribeMessages, markMessageAnswered, type ContactMessage } from '../lib/messages';

// There's no outbound email sending wired into this app — "Reply" hands off
// to the volunteer's own email client via mailto:, prefilled. Marking a
// message answered is a separate, explicit action so the queue reflects
// what's actually been dealt with, not just opened.
export default function AdminMessages() {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [tab, setTab] = useState<'pending' | 'answered'>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeMessages(setMessages, () => setMessages([]));
    return unsub;
  }, []);

  const filtered = messages.filter((m) => m.status === tab);
  const selected = filtered.find((m) => m.id === selectedId) || filtered[0] || null;

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="container-xl py-6 md:py-8">
      <h1 className="h2 !text-2xl mb-6">{t('nav.contact')}</h1>

      {/* A zero-padding Card wrapping list + thread, per the prototype: the
          neutral card fill is the resting tone, the selected row fills the
          lighter page surface to stand out against it. */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-100 md:flex max-w-4xl min-h-[360px]">
        {/* List — flex: 1 1 300px */}
        <div className="md:flex-[1_1_300px] md:shrink-0 md:border-r border-slate-200">
          <div className="flex gap-4 px-4 py-3 border-b border-slate-200 text-sm font-semibold">
            <button onClick={() => setTab('pending')} className={tab === 'pending' ? 'text-brand-600' : 'text-slate-600'}>
              {t('admin.messages_pending')} ({messages.filter((m) => m.status === 'pending').length})
            </button>
            <button onClick={() => setTab('answered')} className={tab === 'answered' ? 'text-brand-600' : 'text-slate-600'}>
              {t('admin.messages_answered')}
            </button>
          </div>
          {filtered.length === 0 ? (
            <p className="text-slate-600 text-sm p-6 text-center">{t('admin.no_messages')}</p>
          ) : (
            filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-slate-200 transition-colors ${selected?.id === m.id ? 'bg-surface' : 'hover:bg-surface/60'}`}
              >
                <span className="w-8 h-8 rounded-full bg-surface border border-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-600 shrink-0">
                  {m.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{m.name}</p>
                  <p className="text-xs text-slate-600 mt-0.5 truncate">{m.context || formatDate(m.createdAt)}</p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Thread — flex: 2 1 420px */}
        <div className="md:flex-[2_1_420px] min-w-0 p-6">
          {selected ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 flex-wrap pb-4 border-b border-slate-200">
                <span className="w-11 h-11 rounded-full bg-surface border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
                  {selected.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{selected.name}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{selected.context || selected.email} · {formatDate(selected.createdAt)}</p>
                </div>
                {selected.status === 'pending' && (
                  <button onClick={() => void markMessageAnswered(selected.id)} className="btn btn-outline !py-1.5 !px-3 text-sm ml-auto">
                    {t('admin.mark_answered')}
                  </button>
                )}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap measure-prose">{selected.message}</p>
              <div className="flex gap-3 mt-2">
                <a
                  href={`mailto:${selected.email}?subject=${encodeURIComponent('Re: ' + (selected.context || 'Anê Thành'))}`}
                  className="btn btn-primary"
                >
                  {t('admin.reply_via_email')}
                </a>
              </div>
            </div>
          ) : (
            <p className="text-slate-600 text-sm">{t('admin.no_messages')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
