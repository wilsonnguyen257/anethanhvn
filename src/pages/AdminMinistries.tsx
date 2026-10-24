import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useLanguage } from '../contexts/LanguageContext';
import { subscribeJson, saveItem, saveJson, deleteItem } from '../lib/storage';
import { logAuditAction } from '../lib/audit';
import toast from 'react-hot-toast';

export type RosterMember = {
  id: string;
  name: string;
  role: string;
  photoUrl?: string;
  visible: boolean;
  order: number;
};

export default function AdminMinistries() {
  const { t, language } = useLanguage();
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [formData, setFormData] = useState({ name: '', role: '', photoUrl: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsub = subscribeJson<RosterMember[]>('roster', (data) => {
      setRoster((data || []).slice().sort((a, b) => a.order - b.order));
    });
    return unsub;
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.role.trim()) return;
    setIsSubmitting(true);
    try {
      const member: RosterMember = {
        id: uuidv4(),
        name: formData.name.trim(),
        role: formData.role.trim(),
        photoUrl: formData.photoUrl.trim() || undefined,
        visible: true,
        // roster.length collides with an existing order value once any
        // member has been deleted (e.g. 3 members order 0/1/2, delete the
        // middle one, length is back to 2 but the survivors are 0/2) — use
        // one past the current max instead so order stays unique.
        order: roster.length ? Math.max(...roster.map((m) => m.order)) + 1 : 0,
      };
      await saveItem('roster', member);
      await logAuditAction('roster.create', { name: member.name });
      setFormData({ name: '', role: '', photoUrl: '' });
      toast.success(t('admin.save'));
    } catch {
      toast.error(language === 'vi' ? 'Lỗi khi lưu.' : 'Error saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleVisible = async (member: RosterMember) => {
    await saveItem('roster', { ...member, visible: !member.visible });
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= roster.length) return;
    const updated = roster.slice();
    const a = updated[index];
    const b = updated[target];
    updated[index] = { ...b, order: a.order };
    updated[target] = { ...a, order: b.order };
    // Write both swapped members in one batch (saveJson) instead of two
    // sequential saveItem calls — if the second write failed after the
    // first succeeded, both members would end up sharing one `order` value
    // and the roster's sort order would silently become undefined.
    await saveJson('roster', updated);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('admin.delete') + '?')) return;
    try {
      await deleteItem('roster', id);
      await logAuditAction('roster.delete', { id });
    } catch {
      toast.error(language === 'vi' ? 'Lỗi khi xóa.' : 'Error deleting.');
    }
  };

  return (
    <div className="container-xl py-6 md:py-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="h2 !text-2xl">{t('nav.ministries')}</h1>
      </div>

      <div className="border border-slate-200 rounded-2xl overflow-hidden mb-6 max-w-2xl">
        <div className="flex bg-slate-100 px-4 py-2.5 gap-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <span className="w-8" />
          <span className="flex-1">{t('admin.full_name')}</span>
          <span className="w-32">{t('admin.role')}</span>
          <span className="w-16 text-center">{t('admin.visible')}</span>
          <span className="w-20" />
        </div>
        {roster.length === 0 ? (
          <p className="text-slate-600 text-sm py-6 text-center">{t('admin.no_roster')}</p>
        ) : (
          roster.map((member, index) => (
            <div key={member.id} className="flex items-center gap-3 px-4 py-3 border-t border-slate-200">
              <span className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-semibold text-slate-600">
                {member.photoUrl ? <img src={member.photoUrl} alt="" className="w-full h-full object-cover" /> : member.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="flex-1 min-w-0 text-sm font-semibold text-slate-900 truncate">{member.name}</span>
              <span className="w-32 text-sm text-slate-600 truncate">{member.role}</span>
              <button onClick={() => void toggleVisible(member)} className="w-16 text-center">
                {member.visible ? (
                  <span className="text-xs font-semibold text-green-600">✓ {t('admin.visible')}</span>
                ) : (
                  <span className="text-xs font-semibold text-slate-600">◦ {t('admin.hidden')}</span>
                )}
              </button>
              <div className="w-20 flex justify-end gap-1 text-xs">
                <button onClick={() => void move(index, -1)} disabled={index === 0} className="px-1.5 py-1 rounded text-slate-600 hover:text-slate-900 disabled:opacity-30" aria-label={t('admin.move_up')}>▲</button>
                <button onClick={() => void move(index, 1)} disabled={index === roster.length - 1} className="px-1.5 py-1 rounded text-slate-600 hover:text-slate-900 disabled:opacity-30" aria-label={t('admin.move_down')}>▼</button>
                <button onClick={() => void handleDelete(member.id)} className="px-1.5 py-1 rounded text-slate-600 hover:text-red-600" aria-label={t('admin.delete')}>✕</button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card max-w-2xl">
        <p className="eyebrow mb-4">{t('admin.add_person')}</p>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <label htmlFor="ministry-field-1" className="block text-xs font-semibold text-slate-600 mb-1">{t('admin.full_name')}</label>
            <input id="ministry-field-1"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-600"
              required
            />
          </div>
          <div className="flex-1 w-full">
            <label htmlFor="ministry-field-2" className="block text-xs font-semibold text-slate-600 mb-1">{t('admin.role')}</label>
            <input id="ministry-field-2"
              type="text"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-600"
              required
            />
          </div>
          <div className="flex-1 w-full">
            <label htmlFor="ministry-field-3" className="block text-xs font-semibold text-slate-600 mb-1">{t('admin.photo_url')}</label>
            <input id="ministry-field-3"
              type="url"
              value={formData.photoUrl}
              onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <button type="submit" disabled={isSubmitting} className="btn btn-primary shrink-0 w-full sm:w-auto">
            {t('admin.add_person')}
          </button>
        </form>
      </div>
    </div>
  );
}
