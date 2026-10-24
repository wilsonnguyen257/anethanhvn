import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useLanguage } from '../contexts/LanguageContext';
import { subscribeJson, saveItem, deleteItem } from '../lib/storage';
import { logAuditAction } from '../lib/audit';
import { IS_FIREBASE_CONFIGURED, storage as fbStorage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import BilingualForm from '../components/forms/BilingualForm';
import type { Reflection } from '../types/content';
import toast from 'react-hot-toast';
import { compressImage } from '../lib/image';
import { sanitizeRichHtml } from '../lib/sanitizeHtml';
import { validateImageFile, validateOptionalExternalUrl } from '../lib/validation';
import ImageCropModal from '../components/admin/ImageCropModal';

export default function AdminReflections() {
  const { language } = useLanguage();
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');
  const retentionDays = 90;
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    titleVi: '',
    titleEn: '',
    contentVi: '',
    contentEn: '',
    author: '',
    thumbnail: '',
    thumbnailFull: '',
    facebookLink: '',
    youtubeLink: '',
    driveLink: '',
    date: new Date().toISOString().split('T')[0],
  });

  // Management State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'title', direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Load reflections
  useEffect(() => {
    const unsubscribe = subscribeJson<Reflection[]>('reflections', (data) => {
      setReflections(data || []);
    });
    return unsubscribe;
  }, []);

  // Reset form
  const resetForm = () => {
    setFormData({
      titleVi: '',
      titleEn: '',
      contentVi: '',
      contentEn: '',
      author: '',
      thumbnail: '',
      thumbnailFull: '',
      facebookLink: '',
      youtubeLink: '',
      driveLink: '',
      date: new Date().toISOString().split('T')[0],
    });
    setEditingId(null);
  };

  // Edit reflection
  const handleEdit = (r: Reflection) => {
    setFormData({
      titleVi: r.title.vi,
      titleEn: r.title.en,
      contentVi: r.content.vi,
      contentEn: r.content.en,
      author: r.author,
      thumbnail: r.thumbnail || '',
      thumbnailFull: r.thumbnailFull || '',
      facebookLink: r.facebookLink || '',
      youtubeLink: r.youtubeLink || '',
      driveLink: r.driveLink || '',
      date: r.date,
    });
    setEditingId(r.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Upload thumbnail image
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
      const filename = `reflections/${uuidv4()}-${compressedFile.name}`;
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
    // Validate required fields to prevent blank reflections
    if (!formData.titleVi.trim() || !formData.contentVi.trim() || !formData.author.trim()) {
      toast.error(language === 'vi' ? 'Vui lòng điền Tiêu đề, Nội dung và Tác giả.' : 'Please fill in Title, Content, and Author.');
      return;
    }

    // English is optional at entry time, but the public site reads title.en /
    // content.en directly — fall back to the Vietnamese text so a reflection
    // never renders blank when the English tab is left empty.
    const titleEn = formData.titleEn.trim() || formData.titleVi;
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

    const reflection: Reflection = editingId
      ? {
          ...reflections.find(r => r.id === editingId)!,
          title: { vi: formData.titleVi, en: titleEn },
          content: { vi: sanitizedContentVi, en: sanitizedContentEn },
          author: formData.author,
          thumbnail: formData.thumbnail,
          thumbnailFull: formData.thumbnailFull,
          facebookLink: facebook.normalized,
          youtubeLink: youtube.normalized,
          driveLink: drive.normalized,
          date: formData.date,
          updatedAt: new Date().toISOString(),
        }
      : {
          id: uuidv4(),
          title: { vi: formData.titleVi, en: titleEn },
          content: { vi: sanitizedContentVi, en: sanitizedContentEn },
          author: formData.author,
          thumbnail: formData.thumbnail,
          thumbnailFull: formData.thumbnailFull,
          facebookLink: facebook.normalized,
          youtubeLink: youtube.normalized,
          driveLink: drive.normalized,
          date: formData.date,
          status: 'published',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

    const updated = editingId
      ? reflections.map(r => r.id === editingId ? reflection : r)
      : [...reflections, reflection];

    setIsSubmitting(true);
    try {
      await Promise.all([
        saveItem('reflections', reflection),
        logAuditAction(editingId ? 'reflection.update' : 'reflection.create', { id: reflection.id })
      ]);

      setReflections(updated);
      resetForm();
      toast.success(language === 'vi' ? 'Đã lưu thành công!' : 'Saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      toast.error(language === 'vi' ? 'Lỗi khi lưu.' : 'Error saving.');
      // Revert/Reload would happen via subscription or next fetch
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete reflection
  const handleDelete = async (id: string) => {
    if (!confirm(language === 'vi' ? 'Chuyển bài suy niệm vào lưu trữ?' : 'Archive this reflection?')) return;
    
    try {
      const updated: Reflection[] = reflections.map(r => r.id === id ? { ...r, status: 'deleted' as const, deletedAt: new Date().toISOString() } : r);
      const item = updated.find(r => r.id === id);
      if (!item) return;
      
      await Promise.all([
        saveItem('reflections', item),
        logAuditAction('reflection.delete', { id })
      ]);
      
      setReflections(updated);
      toast.success(language === 'vi' ? 'Đã lưu trữ bài viết!' : 'Reflection archived!');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(language === 'vi' ? 'Lỗi khi lưu trữ.' : 'Error archiving.');
    }
  };

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    const updated: Reflection[] = reflections.map(r => r.id === id ? { ...r, status: 'published' as const, deletedAt: undefined } : r);
    const item = updated.find(r => r.id === id);
    if (!item) return;

    try {
      await Promise.all([
        saveItem('reflections', item),
        logAuditAction('reflection.update', { id })
      ]);
      setReflections(updated);
      toast.success(language === 'vi' ? 'Đã khôi phục bài viết!' : 'Reflection restored!');
    } catch (error) {
      console.error('Restore error:', error);
      toast.error(language === 'vi' ? 'Lỗi khi khôi phục.' : 'Error restoring.');
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm(language === 'vi' ? 'Xóa vĩnh viễn bài suy niệm này?' : 'Permanently delete this reflection?')) return;
    try {
      const item = reflections.find(r => r.id === id);
      const updated = reflections.filter(r => r.id !== id);
      await Promise.all([
        deleteItem('reflections', id),
        logAuditAction('reflection.delete', { id }),
        (async () => {
          if (item?.thumbnail && IS_FIREBASE_CONFIGURED && fbStorage) {
            try {
              const fileRef = ref(fbStorage, item.thumbnail);
              await deleteObject(fileRef);
            } catch {
              void 0;
            }
          }
        })(),
        (async () => {
          if (item?.thumbnailFull && item.thumbnailFull !== item.thumbnail && IS_FIREBASE_CONFIGURED && fbStorage) {
            try {
              const fileRef = ref(fbStorage, item.thumbnailFull);
              await deleteObject(fileRef);
            } catch {
              void 0;
            }
          }
        })()
      ]);
      setReflections(updated);
      toast.success(language === 'vi' ? 'Đã xóa vĩnh viễn!' : 'Permanently deleted!');
    } catch (error) {
      console.error('Permanent delete error:', error);
      toast.error(language === 'vi' ? 'Lỗi khi xóa vĩnh viễn.' : 'Error permanently deleting.');
    }
  };

  // Filter and Sort
  const filteredReflections = reflections
    .filter(r => {
      if (activeTab === 'active' && r.status === 'deleted') return false;
      if (activeTab === 'archive' && r.status !== 'deleted') return false;
      const searchLower = searchTerm.toLowerCase();
      return (
        r.title.vi.toLowerCase().includes(searchLower) ||
        r.title.en.toLowerCase().includes(searchLower) ||
        r.author.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      if (sortConfig.key === 'date') {
        return sortConfig.direction === 'asc' 
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date);
      } else {
        const titleA = a.title.vi || a.title.en;
        const titleB = b.title.vi || b.title.en;
        return sortConfig.direction === 'asc'
          ? titleA.localeCompare(titleB)
          : titleB.localeCompare(titleA);
      }
    });

  // Pagination
  const totalPages = Math.ceil(filteredReflections.length / itemsPerPage);
  const paginatedReflections = filteredReflections.slice(
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
              {language === 'vi' ? 'Quản Lý Suy Niệm' : 'Manage Reflections'}
            </h1>
            <p className="text-slate-600 mt-1 text-sm">
              {language === 'vi' ? 'Tổng số:' : 'Total posts:'} <span className="font-semibold text-brand-600">{reflections.length}</span>
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

      {/* Composer — editor (flex: 2 1 420px) + sidebar (flex: 1 1 280px)
          with publish actions and "Bài gần đây", per the prototype. No
          Trạng thái/draft select — reflections publish immediately in this
          app, same as events. */}
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
              {editingId ? (language === 'vi' ? 'Chỉnh Sửa Bài Viết' : 'Edit Reflection') : (language === 'vi' ? 'Thêm Bài Viết Mới' : 'Add New Reflection')}
            </h2>
          </div>

          <div className="grid gap-6">
            <BilingualForm
              title={language === 'vi' ? 'Tiêu đề' : 'Title'}
              required
              type="input"
              value={{ vi: formData.titleVi, en: formData.titleEn }}
              onChange={(v) => setFormData({ ...formData, titleVi: v.vi, titleEn: v.en })}
              placeholder={{
                vi: 'Nhập tiêu đề...',
                en: 'Enter title...',
              }}
            />

            <BilingualForm
              title={language === 'vi' ? 'Nội dung' : 'Content'}
              required
              type="editor"
              value={{ vi: formData.contentVi, en: formData.contentEn }}
              onChange={(v) => setFormData({ ...formData, contentVi: v.vi, contentEn: v.en })}
              placeholder={{
                vi: 'Nhập nội dung...',
                en: 'Enter content...',
              }}
            />

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="reflection-field-1" className="block text-sm font-medium text-slate-700 mb-2">
                {language === 'vi' ? 'Ngày' : 'Date'}
              </label>
              <input id="reflection-field-1"
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-surface px-4 py-2.5 focus:ring-2 focus:ring-brand-600 focus:border-transparent transition-colors"
              />
            </div>
            <div>
              <label htmlFor="reflection-field-2" className="block text-sm font-medium text-slate-700 mb-2">
                {language === 'vi' ? 'Tác giả' : 'Author'} <span className="text-red-500">*</span>
              </label>
              <input id="reflection-field-2"
                placeholder={language === 'vi' ? 'Nhập tên tác giả...' : 'Enter author name...'}
                value={formData.author}
                onChange={e => setFormData({ ...formData, author: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-surface px-4 py-2.5 focus:ring-2 focus:ring-brand-600 focus:border-transparent transition-colors"
                required
              />
            </div>
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
                aspect={16 / 9} // Reflection card: h-40 fixed height, ~2.0-2.2 measured column ratio
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

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="reflection-field-5" className="block text-sm font-medium text-slate-700 mb-2">
                Facebook Link
              </label>
              <input id="reflection-field-5"
                placeholder="https://facebook.com/..."
                value={formData.facebookLink}
                onChange={e => setFormData({ ...formData, facebookLink: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-surface px-4 py-2.5 focus:ring-2 focus:ring-brand-600 focus:border-transparent transition-colors"
              />
            </div>
            <div>
              <label htmlFor="reflection-field-3" className="block text-sm font-medium text-slate-700 mb-2">
                YouTube Link
              </label>
              <input id="reflection-field-3"
                placeholder="https://youtube.com/..."
                value={formData.youtubeLink}
                onChange={e => setFormData({ ...formData, youtubeLink: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-surface px-4 py-2.5 focus:ring-2 focus:ring-brand-600 focus:border-transparent transition-colors"
              />
            </div>
            <div>
              <label htmlFor="reflection-field-4" className="block text-sm font-medium text-slate-700 mb-2">
                Google Drive Link
              </label>
              <input id="reflection-field-4"
                placeholder="https://drive.google.com/..."
                value={formData.driveLink}
                onChange={e => setFormData({ ...formData, driveLink: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-surface px-4 py-2.5 focus:ring-2 focus:ring-brand-600 focus:border-transparent transition-colors"
              />
            </div>
          </div>

          </div>
        </div>

        {/* Sidebar — publish actions + recent posts */}
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
                  {uploading ? (language === 'vi' ? 'Đang tải...' : 'Uploading...') : (language === 'vi' ? 'Đang lưu...' : 'Saving...')}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {editingId ? (language === 'vi' ? 'Cập Nhật' : 'Update') : (language === 'vi' ? 'Lưu Bài Viết' : 'Save Reflection')}
                </>
              )}
            </button>
            {editingId && (
              <button onClick={resetForm} className="btn btn-outline w-full justify-center">
                {language === 'vi' ? 'Hủy Bỏ' : 'Cancel'}
              </button>
            )}
          </div>

          {reflections.length > 0 && (
            <div className="card flex flex-col gap-3">
              <p className="eyebrow">{language === 'vi' ? 'Bài gần đây' : 'Recent posts'}</p>
              {reflections
                .filter(r => r.status !== 'deleted')
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 5)
                .map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleEdit(r)}
                    className="text-left text-sm text-slate-700 hover:text-brand-600 transition-colors truncate"
                  >
                    {r.title.vi || r.title.en}
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
                <input aria-label={language === 'vi' ? 'Tìm kiếm' : 'Search'}
                    placeholder={language === 'vi' ? 'Tìm kiếm...' : 'Search...'}
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
                      setSortConfig({ key: key as 'date'|'title', direction: direction as 'asc'|'desc' });
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-surface focus:ring-2 focus:ring-brand-600 focus:border-transparent cursor-pointer w-full sm:w-auto"
              >
                  <option value="date-desc">{language === 'vi' ? 'Mới nhất' : 'Newest First'}</option>
                  <option value="date-asc">{language === 'vi' ? 'Cũ nhất' : 'Oldest First'}</option>
                  <option value="title-asc">{language === 'vi' ? 'Tiêu đề (A-Z)' : 'Title (A-Z)'}</option>
              </select>
          </div>
        </div>
        <table className="w-full">
          <thead className="bg-slate-100 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">{language === 'vi' ? 'Tiêu đề' : 'Title'}</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">{language === 'vi' ? 'Liên kết' : 'Links'}</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">{language === 'vi' ? 'Tác giả' : 'Author'}</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">{language === 'vi' ? 'Ngày' : 'Date'}</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">{language === 'vi' ? 'Hành động' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {paginatedReflections.map(r => (
              <tr key={r.id} className="hover:bg-slate-100/60 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {r.thumbnail && (
                      <img src={r.thumbnail} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div>
                      <div className="font-medium text-slate-900">{r.title.vi || r.title.en}</div>
                      {r.title.en && r.title.vi && r.title.en !== r.title.vi && <div className="text-sm text-slate-600">{r.title.en}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    {r.facebookLink && (
                      <a href={r.facebookLink} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-brand-600 transition-colors" title="Facebook">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>
                      </a>
                    )}
                    {r.youtubeLink && (
                      <a href={r.youtubeLink} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-brand-600 transition-colors" title="YouTube">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                      </a>
                    )}
                    {r.driveLink && (
                      <a href={r.driveLink} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-brand-600 transition-colors" title="Drive">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.01 1.485c2.082 0 3.754.02 3.743.047.01.02 1.708 2.985 3.787 6.62l.02.043-4.814 8.35-4.813 8.36L5.786 16.51c-2.28-3.96-4.14-7.21-4.14-7.23s1.86-3.26 4.14-7.22c2.27-3.95 4.15-7.2 4.16-7.2.02 0 1.05-.01 2.06.02zm4.61 7.42c1.93 3.36 3.51 6.13 3.5 6.14-.01.02-3.32.03-7.37.03l-7.34.01 2.22-3.86c1.23-2.11 2.25-3.88 2.27-3.93a121.2 121.2 0 0 1 6.72 1.6zM1.48 22.42c-.01.03.49.05 1.13.06 1.02.01 9.07.01 9.07 0 0-.01-1.63-2.85-3.63-6.3l-3.63-6.32-1.48 2.56c-.81 1.4-1.48 2.58-1.48 2.62 0 .04.01 3.33.02 7.32z"/></svg>
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-600">{r.author}</td>
                <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{r.date}</td>
                <td className="px-6 py-4 text-right whitespace-nowrap">
                  <div className="flex justify-end gap-3">
                    {activeTab === 'active' ? (
                      <>
                        <button
                          onClick={() => handleEdit(r)}
                          className="text-brand-600 hover:text-brand-800 font-medium transition-colors"
                        >
                          {language === 'vi' ? 'Sửa' : 'Edit'}
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="text-red-600 hover:text-red-800 font-medium transition-colors"
                        >
                          {language === 'vi' ? 'Lưu trữ' : 'Archive'}
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="text-sm text-slate-600 inline-block mr-4">
                          {language === 'vi' ? 'Đã xóa lúc:' : 'Deleted at:'} {r.deletedAt ? new Date(r.deletedAt).toLocaleString() : ''}
                          {' · '}
                          {language === 'vi' ? 'Còn lại' : 'Days left'}: {r.deletedAt ? Math.max(0, retentionDays - Math.floor((Date.now() - new Date(r.deletedAt).getTime()) / (1000 * 60 * 60 * 24))) : retentionDays}
                        </div>
                        <button
                          onClick={() => handleRestore(r.id)}
                          disabled={restoringId === r.id}
                          className={`text-green-600 hover:text-green-800 font-medium transition-colors ${restoringId === r.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {restoringId === r.id ? (
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
                          onClick={() => handlePermanentDelete(r.id)}
                          className="text-red-600 hover:text-red-800 font-medium transition-colors"
                        >
                          {language === 'vi' ? 'Xóa vĩnh viễn' : 'Delete Permanently'}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {paginatedReflections.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-600">
                  {language === 'vi' ? 'Không tìm thấy bài viết nào' : 'No reflections found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
            <div className="flex justify-between items-center px-6 py-4 border-t border-slate-200 bg-slate-100">
                <div className="text-sm text-slate-600">
                    {language === 'vi'
                        ? `Hiển thị ${(currentPage - 1) * itemsPerPage + 1} đến ${Math.min(currentPage * itemsPerPage, filteredReflections.length)} trong số ${filteredReflections.length}`
                        : `Showing ${(currentPage - 1) * itemsPerPage + 1} to ${Math.min(currentPage * itemsPerPage, filteredReflections.length)} of ${filteredReflections.length}`}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded-xl border border-slate-200 bg-surface disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200/60 transition-colors"
                    >
                        {language === 'vi' ? 'Trước' : 'Previous'}
                    </button>
                    <span className="px-3 py-1 bg-surface border border-slate-200 rounded-xl text-slate-700 font-medium">
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
