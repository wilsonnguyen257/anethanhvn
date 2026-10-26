import React, { useState, useEffect } from 'react';
import { getJson, saveItem, deleteItem } from '../lib/storage';
import { v4 as uuidv4 } from 'uuid';
import { IS_FIREBASE_CONFIGURED, storage as fbStorage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';
import { processImageForUpload } from '../lib/image';
import { validateDateInput, validateImageFile, validateRequiredText } from '../lib/validation';
import ImageCropModal from '../components/admin/ImageCropModal';

type GalleryCategory = 'mass' | 'events' | 'youth';

type GalleryItem = {
  id: string;
  url: string;
  name: string;
  created: number;
  path?: string;
  thumbnailUrl?: string;
  thumbnailPath?: string;
  category?: GalleryCategory;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function AdminGallery() {
  const { t } = useLanguage();
  const [images, setImages] = useState<GalleryItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [croppedThumbnail, setCroppedThumbnail] = useState<File | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editCategory, setEditCategory] = useState<GalleryCategory | ''>('');
  const [uploadCategory, setUploadCategory] = useState<GalleryCategory | ''>('');

  const categoryOptions: { value: GalleryCategory; label: string }[] = [
    { value: 'mass', label: t('gallery.filter_mass') },
    { value: 'events', label: t('gallery.filter_events') },
    { value: 'youth', label: t('gallery.filter_youth') },
  ];

  // Management State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Load gallery metadata from Firebase Storage JSON
  useEffect(() => {
    setUploading(true);
    let active = true;
    (async () => {
      try {
        const items = await getJson<GalleryItem[]>('gallery');
        if (active) setImages(items || []);
      } catch {
        toast.error(t('admin.gallery.error_load'));
      } finally {
        if (active) setUploading(false);
      }
    })();
    return () => { active = false; };
  }, [t]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = e.target.files?.[0] || null;
    if (!nextFile) {
      setFile(null);
      return;
    }

    const fileError = validateImageFile(nextFile);
    if (fileError) {
      toast.error(fileError);
      e.target.value = '';
      setFile(null);
      return;
    }

    // Crop before uploading, matched to the grid tile's aspect ratio — see
    // ImageCropModal below. handleUpload uses the cropped file for the
    // thumbnail only; the full photo (lightbox) stays uncropped.
    setPendingFile(nextFile);
    setCropModalOpen(true);
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!file) return;

    const fileError = validateImageFile(file);
    if (fileError) {
      toast.error(fileError);
      return;
    }
    
    setUploading(true);
    
    try {
      // Normalizes the photo to a consistent format/size and produces a
      // small thumbnail alongside the full display version, so the grid
      // doesn't have to download full-size images just to show a tile.
      const { display, thumbnail } = await processImageForUpload(file, croppedThumbnail ?? undefined);
      const uid = uuidv4();
      let url = '';
      let thumbnailUrl = '';
      let path: string | undefined;
      let thumbnailPath: string | undefined;

      if (IS_FIREBASE_CONFIGURED && fbStorage) {
        // Upload to Firebase Storage and get public URLs
        path = `gallery/${uid}/${display.name}`;
        const objectRef = ref(fbStorage, path);
        await uploadBytes(objectRef, display);
        url = await getDownloadURL(objectRef);

        if (thumbnail !== display) {
          thumbnailPath = `gallery/${uid}/${thumbnail.name}`;
          const thumbRef = ref(fbStorage, thumbnailPath);
          await uploadBytes(thumbRef, thumbnail);
          thumbnailUrl = await getDownloadURL(thumbRef);
        } else {
          thumbnailUrl = url;
          thumbnailPath = path;
        }
      } else {
        // Fallback: data URLs for local/preview-only storage
        url = await fileToDataUrl(display);
        thumbnailUrl = thumbnail !== display ? await fileToDataUrl(thumbnail) : url;
      }
      const newItem: GalleryItem = {
        id: uid,
        url,
        thumbnailUrl,
        name: display.name || 'image',
        created: Date.now(),
        path,
        thumbnailPath,
        category: uploadCategory || undefined,
      };
      const updated = [...images, newItem];
      await saveItem('gallery', newItem);
      setImages(updated);
      setFile(null);
      setCroppedThumbnail(null);
      setUploadCategory('');
      toast.success(t('admin.gallery.upload_success') || 'Upload successful');
    } catch (err) {
      toast.error(t('admin.gallery.error_upload'));
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (img: GalleryItem) => {
    setEditingId(img.id);
    setEditName(img.name);
    setEditDate(new Date(img.created).toISOString().split('T')[0]);
    setEditCategory(img.category || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDate('');
    setEditCategory('');
  };

  const saveEdit = async (id: string) => {
    try {
      const itemToUpdate = images.find(img => img.id === id);
      if (!itemToUpdate) return;

      const nameError = validateRequiredText(editName, 'Image name');
      const dateError = validateDateInput(editDate);
      const validationError = nameError || dateError;
      if (validationError) {
        toast.error(validationError);
        return;
      }
      
      const newItem = {
        ...itemToUpdate,
        name: editName.trim(),
        created: new Date(`${editDate}T00:00:00`).getTime(),
        category: editCategory || undefined,
      };
      
      const updated = images.map(img => img.id === id ? newItem : img);
      await saveItem('gallery', newItem);
      setImages(updated);
      cancelEdit();
      toast.success(t('admin.gallery.update_success') || 'Update successful');
    } catch (err) {
      toast.error(t('admin.gallery.error_update'));
      console.error('Update error:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin.gallery.confirm_delete'))) return;
    try {
      const image = images.find(i => i.id === id);
      if (!image) throw new Error('Image not found');
      // Try to delete from Firebase Storage if configured and path recorded
      if (IS_FIREBASE_CONFIGURED && fbStorage && image.path) {
        try {
          await deleteObject(ref(fbStorage, image.path));
        } catch (err) {
          console.warn('Failed to delete storage object; proceeding to update index', err);
        }
      }
      if (IS_FIREBASE_CONFIGURED && fbStorage && image.thumbnailPath && image.thumbnailPath !== image.path) {
        try {
          await deleteObject(ref(fbStorage, image.thumbnailPath));
        } catch (err) {
          console.warn('Failed to delete thumbnail storage object; proceeding to update index', err);
        }
      }
      const updated = images.filter(img => img.id !== id);
      await deleteItem('gallery', id);
      setImages(updated);
      toast.success(t('admin.gallery.delete_success') || 'Delete successful');
    } catch (err) {
      toast.error(t('admin.gallery.error_delete'));
      console.error('Delete error:', err);
    }
  };

  // Filter and Pagination
  const filteredImages = images.filter(img => 
    img.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const totalPages = Math.ceil(filteredImages.length / itemsPerPage);
  const paginatedImages = filteredImages.slice(
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
              {t('admin.manage_gallery')}
            </h1>
            <p className="text-slate-600 mt-1 text-sm">
              {t('admin.gallery.total') || 'Total images:'} <span className="font-semibold text-brand-600">{images.length}</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              {/* Search */}
              <div className="relative">
                <input aria-label={t('admin.gallery.search') || 'Search images...'}
                    placeholder={t('admin.gallery.search') || 'Search images...'}
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-surface w-full sm:w-64 focus:ring-2 focus:ring-brand-600 focus:border-transparent transition-colors"
                />
                <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
          <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900">{t('admin.gallery.upload_new')}</h2>
        </div>

        <p className="text-sm text-slate-600 mb-6 flex items-start gap-2 bg-brand-50 p-3 rounded-xl border border-brand-100">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
          </svg>
          <span>{IS_FIREBASE_CONFIGURED ? t('admin.gallery.firebase_desc') : t('admin.gallery.no_firebase')}</span>
        </p>

        <div className="mb-6 max-w-xs">
          <label htmlFor="gallery-field-1" className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
            {t('admin.gallery.category')}
          </label>
          <select id="gallery-field-1"
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value as GalleryCategory | '')}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-surface text-slate-900 focus:ring-2 focus:ring-brand-600 focus:border-transparent cursor-pointer"
          >
            <option value="">{t('gallery.filter_all')}</option>
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <label
              htmlFor="file-upload"
              className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                file ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-100 hover:bg-slate-200/60'
              }`}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg className={`w-10 h-10 mb-3 ${file ? 'text-brand-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mb-2 text-sm text-slate-600">
                  <span className="font-semibold">{file ? file.name : t('admin.gallery.choose_file')}</span>
                </p>
                {!file && <p className="text-xs text-slate-600">PNG, JPG, GIF up to 10MB — automatically optimized to WebP</p>}
              </div>
              <input
                id="file-upload"
                type="file"
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
          <div className="flex items-center">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="btn btn-primary w-full md:w-auto"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{t('admin.gallery.uploading')}</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>{t('admin.gallery.upload_button')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {cropModalOpen && pendingFile && (
        <ImageCropModal
          file={pendingFile}
          aspect={4 / 3} // Gallery grid tile: h-[200px] fixed height, ~4:3 measured column ratio
          title={t('admin.gallery.crop_title')}
          onCropComplete={(cropped) => {
            setFile(pendingFile);
            setCroppedThumbnail(cropped);
            setPendingFile(null);
            setCropModalOpen(false);
          }}
          onCancel={() => {
            setPendingFile(null);
            setCropModalOpen(false);
          }}
        />
      )}

      {paginatedImages.length === 0 ? (
        <div className="card !p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-surface border border-slate-200 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-slate-600 font-medium">{searchTerm ? 'No matching images found' : t('admin.gallery.no_images')}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedImages.map((img) => (
              <div key={img.id} className="card !p-0 overflow-hidden">
                <div className="relative overflow-hidden aspect-[4/3] group">
                  <img
                    src={img.thumbnailUrl || img.url}
                    alt={img.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/40 transition-colors duration-200"></div>

                  {/* Overlay actions — color/opacity only, nothing moves. */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
                    <button
                        onClick={() => startEdit(img)}
                        className="flex-1 bg-surface text-brand-700 py-2 rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors"
                    >
                        {t('admin.gallery.edit')}
                    </button>
                    <button
                        onClick={() => handleDelete(img.id)}
                        className="flex-1 bg-red-600 text-surface py-2 rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors"
                    >
                        {t('admin.gallery.delete')}
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  {editingId === img.id ? (
                    <div className="space-y-3">
                      <input aria-label={t('admin.gallery.name')}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-surface text-sm focus:ring-2 focus:ring-brand-600 focus:border-transparent"
                        placeholder={t('admin.gallery.name')}
                        autoFocus
                      />
                      <input aria-label={t('admin.gallery.date')}
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-surface text-sm focus:ring-2 focus:ring-brand-600 focus:border-transparent"
                      />
                      <select aria-label={t('admin.gallery.category')}
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value as GalleryCategory | '')}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-surface text-sm focus:ring-2 focus:ring-brand-600 focus:border-transparent cursor-pointer"
                      >
                        <option value="">{t('gallery.filter_all')}</option>
                        {categoryOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(img.id)}
                          className="btn btn-primary flex-1 !py-1.5 !px-2 text-xs"
                        >
                          {t('admin.gallery.save')}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="btn btn-outline flex-1 !py-1.5 !px-2 text-xs"
                        >
                          {t('admin.gallery.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm font-semibold text-slate-900 truncate mb-1" title={img.name}>
                        {img.name}
                      </div>
                      <div className="text-xs text-slate-600 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{new Date(img.created).toLocaleDateString()}</span>
                        {img.category && (
                          <span className="ml-auto rounded-full bg-slate-200 text-slate-700 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
                            {categoryOptions.find((o) => o.value === img.category)?.label}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8 gap-2">
                <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-surface disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors font-medium text-slate-700"
                >
                    {t('admin.pagination.prev') || 'Previous'}
                </button>
                <span className="px-4 py-2 bg-surface border border-slate-200 rounded-xl text-slate-700 font-medium">
                    {currentPage} / {totalPages}
                </span>
                <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-surface disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors font-medium text-slate-700"
                >
                    {t('admin.pagination.next') || 'Next'}
                </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
