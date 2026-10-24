import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { useLanguage } from '../contexts/LanguageContext';
import { getJson, saveItem, deleteItem } from '../lib/storage';
import { logAuditAction } from '../lib/audit';
import { IS_FIREBASE_CONFIGURED, storage as fbStorage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import BilingualForm from '../components/forms/BilingualForm';
import type { Event } from '../types/content';
import { compressImage } from '../lib/image';
import { sanitizeRichHtml } from '../lib/sanitizeHtml';
import { validateImageFile, validateOptionalExternalUrl } from '../lib/validation';
import ImageCropModal from '../components/admin/ImageCropModal';

export default function AdminEvents() {
  const { language } = useLanguage();
  const [events, setEvents] = useState<Event[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const retentionDays = 90;
  
  // Management State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'name', direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [formData, setFormData] = useState({
    nameVi: '',
    nameEn: '',
    date: new Date().toISOString().split('T')[0],
    time: '5:00 PM',
    location: '',
    contentVi: '',
    contentEn: '',
    thumbnail: '',
    thumbnailFull: '',
    facebookLink: '',
    youtubeLink: '',
    driveLink: '',
  });

  // Load events
  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    const data = await getJson<Event[]>('events');
    setEvents(data || []);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      nameVi: '',
      nameEn: '',
      date: new Date().toISOString().split('T')[0],
      time: '5:00 PM',
      location: '',
      contentVi: '',
      contentEn: '',
      thumbnail: '',
      thumbnailFull: '',
      facebookLink: '',
      youtubeLink: '',
      driveLink: '',
    });
    setEditingId(null);
  };

  // Edit event
  const handleEdit = (e: Event) => {
    setFormData({
      nameVi: e.name?.vi || '',
      nameEn: e.name?.en || '',
      date: e.date || new Date().toISOString().split('T')[0],
      time: e.time || '5:00 PM',
      location: e.location || '',
      contentVi: e.content?.vi || '',
      contentEn: e.content?.en || '',
      thumbnail: e.thumbnail || '',
      thumbnailFull: e.thumbnailFull || '',
      facebookLink: e.facebookLink || '',
      youtubeLink: e.youtubeLink || '',
      driveLink: e.driveLink || '',
    });
    setEditingId(e.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Upload image
  const handleImageUpload = async (file: File) => {
    if (!IS_FIREBASE_CONFIGURED || !fbStorage) return '';

    const fileError = validateImageFile(file);
    if (fileError) {
      toast.error(fileError);
      return '';
    }
    
    setUploading(true);
    try {
      const compressedFile = await compressImage(file);
      const filename = `events/${uuidv4()}-${compressedFile.name}`;
      const storageRef = ref(fbStorage, filename);
      await uploadBytes(storageRef, compressedFile);
      const url = await getDownloadURL(storageRef);
      return url;
    } catch {
      toast.error('Upload failed');
      return '';
    } finally {
      setUploading(false);
    }
  };

  // Save (create or update)
  const handleSave = async () => {
    // Validate required fields to prevent blank events
    if (!formData.nameVi.trim() || !formData.date || !formData.time || !formData.location.trim()) {
      toast.error(language === 'vi' ? 'Vui lòng điền đầy đủ Tên, Ngày, Giờ và Địa điểm.' : 'Please fill in Name, Date, Time, and Location.');
      return;
    }

    // English is optional at entry time, but the public site reads name.en /
    // content.en directly — fall back to the Vietnamese text so an event
    // never renders blank when the English tab is left empty.
    const nameEn = formData.nameEn.trim() || formData.nameVi;
    const contentEnRaw = formData.contentEn.trim() || formData.contentVi;

    const sanitizedContentVi = sanitizeRichHtml(formData.contentVi);
    const sanitizedContentEn = sanitizeRichHtml(contentEnRaw);
    const facebook = validateOptionalExternalUrl(formData.facebookLink, 'facebook');
    const youtube = validateOptionalExternalUrl(formData.youtubeLink, 'youtube');
    const drive = validateOptionalExternalUrl(formData.driveLink, 'drive');

    const linkError = facebook.error || youtube.error || drive.error;
    if (linkError) {
      toast.error(linkError);
      return;
    }

    const event: Event = editingId
      ? {
          ...events.find(e => e.id === editingId)!,
          name: { vi: formData.nameVi, en: nameEn },
          date: formData.date,
          time: formData.time,
          location: formData.location,
          content: { vi: sanitizedContentVi, en: sanitizedContentEn },
          thumbnail: formData.thumbnail,
          thumbnailFull: formData.thumbnailFull,
          facebookLink: facebook.normalized,
          youtubeLink: youtube.normalized,
          driveLink: drive.normalized,
        }
      : {
          id: uuidv4(),
          name: { vi: formData.nameVi, en: nameEn },
          date: formData.date,
          time: formData.time,
          location: formData.location,
          content: { vi: sanitizedContentVi, en: sanitizedContentEn },
          thumbnail: formData.thumbnail,
          thumbnailFull: formData.thumbnailFull,
          facebookLink: facebook.normalized,
          youtubeLink: youtube.normalized,
          driveLink: drive.normalized,
          status: 'published',
        };

    const updated = editingId
      ? events.map(e => e.id === editingId ? event : e)
      : [...events, event];

    setIsSubmitting(true);
    try {
      await Promise.all([
        saveItem('events', event),
        logAuditAction(editingId ? 'event.update' : 'event.create', { id: event.id })
      ]);
      
      setEvents(updated);
      resetForm();
      // loadEvents(); // Removed to avoid double fetch and improve speed
      toast.success(language === 'vi' ? 'Đã lưu thành công!' : 'Saved successfully!');
    } catch (err) {
      console.error('Save error:', err);
      toast.error(language === 'vi' ? 'Lỗi khi lưu. Vui lòng thử lại.' : 'Error saving. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete event
  const handleDelete = async (id: string) => {
    // Immediate UI update for better UX
    if (!confirm(language === 'vi' ? 'Chuyển sự kiện vào lưu trữ?' : 'Archive this event?')) return;
    
    setDeletingId(id);
    
    // Optimistically update the UI
    const originalEvents = [...events];
    const updated: Event[] = events.map(e => e.id === id ? { ...e, status: 'deleted' as const, deletedAt: new Date().toISOString() } : e);
    const eventToUpdate = updated.find(e => e.id === id);
    if (!eventToUpdate) return;

    setEvents(updated);

    // Perform the actual save in the background
    try {
      // Don't await the toast, just show it immediately
      toast.success(language === 'vi' ? 'Đã lưu trữ sự kiện!' : 'Event archived!');
      
      await Promise.all([
        saveItem('events', eventToUpdate),
        logAuditAction('event.delete', { id }),
      ]);
    } catch (err) {
      console.error('Delete error:', err);
      // Revert UI on error
      setEvents(originalEvents);
      toast.error(language === 'vi' ? 'Lỗi khi lưu trữ.' : 'Error archiving.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    const updated: Event[] = events.map(e => e.id === id ? { ...e, status: 'published' as const, deletedAt: undefined } : e);
    const eventToUpdate = updated.find(e => e.id === id);
    if (!eventToUpdate) return;

    try {
      await Promise.all([
        saveItem('events', eventToUpdate),
        logAuditAction('event.update', { id })
      ]);
      setEvents(updated);
      toast.success(language === 'vi' ? 'Đã khôi phục sự kiện!' : 'Event restored!');
    } catch (err) {
      console.error('Restore error:', err);
      toast.error(language === 'vi' ? 'Lỗi khi khôi phục.' : 'Error restoring.');
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    // Immediate UI update for better UX
    if (!confirm(language === 'vi' ? 'Xóa vĩnh viễn sự kiện này?' : 'Permanently delete this event?')) return;
    
    setDeletingId(id);
    
    // Optimistically update the UI
    const originalEvents = [...events];
    const updated = events.filter(e => e.id !== id);
    setEvents(updated);

    const event = originalEvents.find(e => e.id === id);

    // Perform the actual save in the background
    try {
      // Don't await the toast, just show it immediately
      toast.success(language === 'vi' ? 'Đã xóa vĩnh viễn!' : 'Permanently deleted!');
      
      await Promise.all([
        deleteItem('events', id),
        logAuditAction('event.delete', { id }),
        (async () => {
          if (event?.thumbnail && IS_FIREBASE_CONFIGURED && fbStorage) {
            try {
              const fileRef = ref(fbStorage, event.thumbnail);
              await deleteObject(fileRef);
            } catch {
              void 0;
            }
          }
        })(),
        (async () => {
          if (event?.thumbnailFull && event.thumbnailFull !== event.thumbnail && IS_FIREBASE_CONFIGURED && fbStorage) {
            try {
              const fileRef = ref(fbStorage, event.thumbnailFull);
              await deleteObject(fileRef);
            } catch {
              void 0;
            }
          }
        })()
      ]);
    } catch (err) {
      console.error('Permanent delete error:', err);
      // Revert UI on error
      setEvents(originalEvents);
      toast.error(language === 'vi' ? 'Lỗi khi xóa vĩnh viễn.' : 'Error permanently deleting.');
    } finally {
      setDeletingId(null);
    }
  };

  // --- Management Logic ---

  // Filter and Sort
  const filteredEvents = events
    .filter(e => {
      if (activeTab === 'active' && e.status === 'deleted') return false;
      if (activeTab === 'archive' && e.status !== 'deleted') return false;
      
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      
      // Safe access properties to prevent crashes
      const nameVi = e.name?.vi?.toLowerCase() || '';
      const nameEn = e.name?.en?.toLowerCase() || '';
      const location = e.location?.toLowerCase() || '';
      const date = e.date || '';

      return (
        nameVi.includes(searchLower) ||
        nameEn.includes(searchLower) ||
        location.includes(searchLower) ||
        date.includes(searchLower)
      );
    })
    .sort((a, b) => {
      if (sortConfig.key === 'date') {
        return sortConfig.direction === 'asc' 
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date);
      } else {
        const nameA = a.name?.vi || a.name?.en || '';
        const nameB = b.name?.vi || b.name?.en || '';
        return sortConfig.direction === 'asc'
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      }
    });

  // Pagination
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="container-xl py-6 md:py-8">
      {/* Header Section */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="h2 !text-2xl">
              {language === 'vi' ? 'Quản Lý Sự Kiện' : 'Manage Events'}
            </h1>
            <p className="text-slate-600 mt-1 text-sm">
              {language === 'vi' ? 'Tổng số:' : 'Total events:'} <span className="font-semibold text-brand-600">{events.length}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveTab('active'); setCurrentPage(1); }}
              className={`btn ${activeTab === 'active' ? 'btn-primary' : 'btn-outline'}`}
            >
              {language === 'vi' ? 'Hoạt động' : 'Active'}
            </button>
            <button
              onClick={() => { setActiveTab('archive'); setCurrentPage(1); }}
              className={`btn ${activeTab === 'archive' ? 'btn-primary' : 'btn-outline'}`}
            >
              {language === 'vi' ? 'Lưu trữ' : 'Archive'}
            </button>
          </div>
        </div>
      </div>

      {/* Composer — a two-column layout per the prototype: the editor
          (flex: 2 1 420px) and a sidebar (flex: 1 1 280px) with the publish
          actions and a quick look at recent events. No Trạng thái/draft
          select here — events publish immediately in this app; there's no
          draft state to select. */}
      <div className="flex flex-col lg:flex-row gap-6 mb-6 items-start">
        <div className="card flex-[2_1_420px] min-w-0 w-full">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${editingId ? 'bg-slate-200 text-slate-700' : 'bg-brand-100 text-brand-600'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {editingId ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                )}
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              {editingId ? (language === 'vi' ? 'Chỉnh Sửa Sự Kiện' : 'Edit Event') : (language === 'vi' ? 'Thêm Sự Kiện Mới' : 'Add New Event')}
            </h2>
          </div>

          <div className="grid gap-6">
          <BilingualForm
            title={language === 'vi' ? 'Tên sự kiện' : 'Event Name'}
            required
            type="input"
            value={{ vi: formData.nameVi, en: formData.nameEn }}
            onChange={(v) => setFormData({ ...formData, nameVi: v.vi, nameEn: v.en })}
            placeholder={{
              vi: 'Nhập tên sự kiện...',
              en: 'Enter event name...',
            }}
          />

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="event-field-1" className="block text-sm font-medium text-slate-700 mb-2">
                {language === 'vi' ? 'Ngày' : 'Date'} <span className="text-red-500">*</span>
              </label>
              <input id="event-field-1"
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-surface px-4 py-2.5 focus:ring-2 focus:ring-brand-600 focus:border-transparent transition-colors"
                required
              />
            </div>
            <div>
              <label htmlFor="event-field-2" className="block text-sm font-medium text-slate-700 mb-2">
                {language === 'vi' ? 'Giờ' : 'Time'} <span className="text-red-500">*</span>
              </label>
              <input id="event-field-2"
                placeholder="e.g. 5:00 PM"
                value={formData.time}
                onChange={e => setFormData({ ...formData, time: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-surface px-4 py-2.5 focus:ring-2 focus:ring-brand-600 focus:border-transparent transition-colors"
                required
              />
            </div>
            <div>
              <label htmlFor="event-field-3" className="block text-sm font-medium text-slate-700 mb-2">
                {language === 'vi' ? 'Địa điểm' : 'Location'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input id="event-field-3"
                  placeholder={language === 'vi' ? 'Nhập địa điểm...' : 'Enter location...'}
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-surface pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-brand-600 focus:border-transparent transition-colors"
                  required
                />
                <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="event-field-4" className="block text-sm font-medium text-slate-700 mb-2">
                Facebook Link
              </label>
              <input id="event-field-4"
                placeholder="https://facebook.com/..."
                value={formData.facebookLink}
                onChange={e => setFormData({ ...formData, facebookLink: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-surface px-4 py-2.5 focus:ring-2 focus:ring-brand-600 focus:border-transparent transition-colors"
              />
            </div>
            <div>
              <label htmlFor="event-field-5" className="block text-sm font-medium text-slate-700 mb-2">
                YouTube Link
              </label>
              <input id="event-field-5"
                placeholder="https://youtube.com/..."
                value={formData.youtubeLink}
                onChange={e => setFormData({ ...formData, youtubeLink: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-surface px-4 py-2.5 focus:ring-2 focus:ring-brand-600 focus:border-transparent transition-colors"
              />
            </div>
            <div>
              <label htmlFor="event-field-6" className="block text-sm font-medium text-slate-700 mb-2">
                Google Drive Link
              </label>
              <input id="event-field-6"
                placeholder="https://drive.google.com/..."
                value={formData.driveLink}
                onChange={e => setFormData({ ...formData, driveLink: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-surface px-4 py-2.5 focus:ring-2 focus:ring-brand-600 focus:border-transparent transition-colors"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-1 gap-6">
            <BilingualForm
              title={language === 'vi' ? 'Mô tả' : 'Description'}
              type="editor"
              value={{ vi: formData.contentVi, en: formData.contentEn }}
              onChange={(v) => setFormData({ ...formData, contentVi: v.vi, contentEn: v.en })}
              placeholder={{
                vi: 'Nhập mô tả chi tiết...',
                en: 'Enter detailed description...',
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {language === 'vi' ? 'Hình ảnh' : 'Image'}
            </label>
            <div className="flex items-start gap-6">
              <div className="flex-1">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-100 hover:bg-slate-200/60 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-8 h-8 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mb-2 text-sm text-slate-600">
                      <span className="font-semibold">{language === 'vi' ? 'Nhấn để tải lên' : 'Click to upload'}</span>
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const selected = e.target.files?.[0];
                      e.target.value = '';
                      if (!selected) return;
                      const fileError = validateImageFile(selected);
                      if (fileError) {
                        toast.error(fileError);
                        return;
                      }
                      setPendingImageFile(selected);
                      setCropModalOpen(true);
                    }}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
              {formData.thumbnail && (
                <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-slate-200 group">
                  <img src={formData.thumbnail} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setFormData({ ...formData, thumbnail: '', thumbnailFull: '' })}
                    className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-surface transition-opacity"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {cropModalOpen && pendingImageFile && (
              <ImageCropModal
                file={pendingImageFile}
                aspect={16 / 9} // Event card: h-40 fixed height, ~1.8-2.2 measured column ratio
                onCropComplete={async (croppedFile) => {
                  setCropModalOpen(false);
                  const originalFile = pendingImageFile;
                  setPendingImageFile(null);
                  // Sequential, not Promise.all — handleImageUpload toggles the
                  // shared `uploading` flag itself; running both in parallel
                  // would flip it back to false while the second is still in
                  // flight.
                  const cardUrl = await handleImageUpload(croppedFile);
                  const heroUrl = await handleImageUpload(originalFile);
                  if (cardUrl) setFormData({ ...formData, thumbnail: cardUrl, thumbnailFull: heroUrl || cardUrl });
                }}
                onCancel={() => {
                  setCropModalOpen(false);
                  setPendingImageFile(null);
                }}
              />
            )}
          </div>
          </div>
        </div>

        {/* Sidebar — publish actions + a quick look at recent events */}
        <div className="flex-[1_1_280px] min-w-0 w-full flex flex-col gap-6">
          <div className="card flex flex-col gap-3">
            <p className="eyebrow">{language === 'vi' ? 'Đăng bài' : 'Publish'}</p>
            <button
              onClick={handleSave}
              disabled={uploading || isSubmitting}
              className="btn btn-primary w-full justify-center"
            >
              {(uploading || isSubmitting) ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {uploading
                    ? (language === 'vi' ? 'Đang tải...' : 'Uploading...')
                    : (language === 'vi' ? 'Đang lưu...' : 'Saving...')}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {editingId ? (language === 'vi' ? 'Cập Nhật' : 'Update Event') : (language === 'vi' ? 'Lưu Sự Kiện' : 'Save Event')}
                </>
              )}
            </button>
            {editingId && (
              <button onClick={resetForm} className="btn btn-outline w-full justify-center">
                {language === 'vi' ? 'Hủy Bỏ' : 'Cancel'}
              </button>
            )}
          </div>

          {events.length > 0 && (
            <div className="card flex flex-col gap-3">
              <p className="eyebrow">{language === 'vi' ? 'Sự kiện gần đây' : 'Recent events'}</p>
              {events
                .filter(e => e.status !== 'deleted')
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 5)
                .map((e) => (
                  <button
                    key={e.id}
                    onClick={() => handleEdit(e)}
                    className="text-left text-sm text-slate-700 hover:text-brand-600 transition-colors truncate"
                  >
                    {e.name?.vi || e.name?.en || 'Unnamed Event'}
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 justify-end items-center bg-slate-100">
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              {/* Search */}
              <div className="relative w-full sm:w-auto">
                <input aria-label={language === 'vi' ? 'Tìm kiếm sự kiện' : 'Search events'}
                    placeholder={language === 'vi' ? 'Tìm kiếm sự kiện...' : 'Search events...'}
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-surface w-full sm:w-64 focus:ring-2 focus:ring-brand-600 focus:border-transparent transition-colors"
                />
                <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Sort */}
              <select aria-label={language === 'vi' ? 'Sắp xếp' : 'Sort'}
                  value={`${sortConfig.key}-${sortConfig.direction}`}
                  onChange={e => {
                      const [key, direction] = e.target.value.split('-');
                      setSortConfig({ key: key as 'date'|'name', direction: direction as 'asc'|'desc' });
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-surface focus:ring-2 focus:ring-brand-600 focus:border-transparent cursor-pointer w-full sm:w-auto"
              >
                  <option value="date-desc">{language === 'vi' ? 'Mới nhất' : 'Newest First'}</option>
                  <option value="date-asc">{language === 'vi' ? 'Cũ nhất' : 'Oldest First'}</option>
                  <option value="name-asc">{language === 'vi' ? 'Tên (A-Z)' : 'Name (A-Z)'}</option>
              </select>
          </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-slate-100">
                <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{language === 'vi' ? 'Sự kiện' : 'Event'}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{language === 'vi' ? 'Liên kết' : 'Links'}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{language === 'vi' ? 'Ngày' : 'Date'}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{language === 'vi' ? 'Giờ' : 'Time'}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{language === 'vi' ? 'Địa điểm' : 'Location'}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">{language === 'vi' ? 'Hành động' : 'Actions'}</th>
                </tr>
            </thead>
            <tbody>
                {paginatedEvents.map(e => (
                <tr key={e.id} className="border-t border-slate-200 hover:bg-slate-100/60">
                    <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                        {e.thumbnail && (
                        <img src={e.thumbnail} alt="" className="w-12 h-12 rounded-lg object-cover" />
                        )}
                        <span className="font-medium text-slate-900">{e.name?.vi || e.name?.en || 'Unnamed Event'}</span>
                    </div>
                    {e.name?.en && e.name?.vi && e.name.en !== e.name.vi && <div className="text-sm text-slate-600 mt-1">{e.name.en}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {e.facebookLink && (
                          <a href={e.facebookLink} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-brand-600 transition-colors" title="Facebook">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>
                          </a>
                        )}
                        {e.youtubeLink && (
                          <a href={e.youtubeLink} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-brand-600 transition-colors" title="YouTube">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                          </a>
                        )}
                        {e.driveLink && (
                          <a href={e.driveLink} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-800" title="Drive">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.01 1.485c2.082 0 3.754.02 3.743.047.01.02 1.708 2.985 3.787 6.62l.02.043-4.814 8.35-4.813 8.36L5.786 16.51c-2.28-3.96-4.14-7.21-4.14-7.23s1.86-3.26 4.14-7.22c2.27-3.95 4.15-7.2 4.16-7.2.02 0 1.05-.01 2.06.02zm4.61 7.42c1.93 3.36 3.51 6.13 3.5 6.14-.01.02-3.32.03-7.37.03l-7.34.01 2.22-3.86c1.23-2.11 2.25-3.88 2.27-3.93a121.2 121.2 0 0 1 6.72 1.6zM1.48 22.42c-.01.03.49.05 1.13.06 1.02.01 9.07.01 9.07 0 0-.01-1.63-2.85-3.63-6.3l-3.63-6.32-1.48 2.56c-.81 1.4-1.48 2.58-1.48 2.62 0 .04.01 3.33.02 7.32z"/></svg>
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{e.date}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{e.time}</td>
                    <td className="px-4 py-3 text-slate-600">{e.location}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                    {activeTab === 'active' ? (
                      <>
                        <button
                          onClick={() => handleEdit(e)}
                          className="text-brand-600 hover:text-brand-800 font-medium mr-4"
                        >
                          {language === 'vi' ? 'Sửa' : 'Edit'}
                        </button>
                        <button
                          onClick={() => handleDelete(e.id)}
                          disabled={deletingId === e.id}
                          className={`text-red-600 hover:text-red-800 font-medium ${deletingId === e.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {deletingId === e.id ? (
                            <span className="inline-flex items-center gap-1">
                              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              {language === 'vi' ? 'Đang lưu trữ...' : 'Archiving...'}
                            </span>
                          ) : (
                            language === 'vi' ? 'Lưu trữ' : 'Archive'
                          )}
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="text-sm text-slate-600 inline-block mr-4">
                          {language === 'vi' ? 'Đã xóa lúc:' : 'Deleted at:'} {e.deletedAt ? new Date(e.deletedAt).toLocaleString() : ''}
                          {' · '}
                          {language === 'vi' ? 'Còn lại' : 'Days left'}: {e.deletedAt ? Math.max(0, retentionDays - Math.floor((Date.now() - new Date(e.deletedAt).getTime()) / (1000 * 60 * 60 * 24))) : retentionDays}
                        </div>
                        <button
                          onClick={() => handleRestore(e.id)}
                          disabled={restoringId === e.id}
                          className={`text-green-600 hover:text-green-800 font-medium mr-4 ${restoringId === e.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {restoringId === e.id ? (
                            <span className="inline-flex items-center gap-1">
                              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              {language === 'vi' ? 'Đang khôi phục...' : 'Restoring...'}
                            </span>
                          ) : (
                            language === 'vi' ? 'Khôi phục' : 'Restore'
                          )}
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(e.id)}
                          disabled={deletingId === e.id}
                          className={`text-red-600 hover:text-red-800 font-medium ${deletingId === e.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {deletingId === e.id ? (
                            <span className="inline-flex items-center gap-1">
                              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              {language === 'vi' ? 'Đang xóa...' : 'Deleting...'}
                            </span>
                          ) : (
                            language === 'vi' ? 'Xóa vĩnh viễn' : 'Delete Permanently'
                          )}
                        </button>
                      </>
                    )}
                    </td>
                </tr>
                ))}
                {paginatedEvents.length === 0 && (
                    <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-600">
                            {language === 'vi' ? 'Không tìm thấy sự kiện nào' : 'No events found'}
                        </td>
                    </tr>
                )}
            </tbody>
            </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
            <div className="flex justify-between items-center px-4 py-3 border-t border-slate-200 bg-slate-100">
                <div className="text-sm text-slate-600">
                    {language === 'vi'
                        ? `Hiển thị ${(currentPage - 1) * itemsPerPage + 1} đến ${Math.min(currentPage * itemsPerPage, filteredEvents.length)} trong số ${filteredEvents.length}`
                        : `Showing ${(currentPage - 1) * itemsPerPage + 1} to ${Math.min(currentPage * itemsPerPage, filteredEvents.length)} of ${filteredEvents.length}`}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded-xl border border-slate-200 bg-surface disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200/60 transition-colors"
                    >
                        {language === 'vi' ? 'Trước' : 'Previous'}
                    </button>
                    <span className="px-3 py-1 bg-surface border border-slate-200 rounded-xl">
                        {currentPage} / {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 rounded-xl border border-slate-200 bg-surface disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200/60 transition-colors"
                    >
                        {language === 'vi' ? 'Sau' : 'Next'}
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
