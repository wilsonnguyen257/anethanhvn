import { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import BilingualForm from '../forms/BilingualForm';
import type { ImageMetadata } from '../../types/gallery';

interface ImageMetadataEditorProps {
  image: ImageMetadata;
  onSave: (updates: Partial<ImageMetadata>) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

// Common tags for suggestions
const COMMON_TAGS = [
  'church', 'mass', 'event', 'ceremony', 'choir', 'community',
  'vietnamese', 'culture', 'tradition', 'celebration', 'holiday',
  'youth', 'children', 'family', 'portrait', 'group',
  'interior', 'exterior', 'architecture', 'stained glass',
  'easter', 'christmas', 'lent', 'advent',
];

export default function ImageMetadataEditor({
  image,
  onSave,
  onCancel,
  loading = false,
}: ImageMetadataEditorProps) {
  const { language } = useLanguage();
  const [formData, setFormData] = useState({
    caption: image.caption || { vi: '', en: '' },
    description: image.description || { vi: '', en: '' },
    tags: image.tags.join(', '),
  });

  const [tagInput, setTagInput] = useState('');
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);

  const t = (en: string, vi: string) => language === 'vi' ? vi : en;

  useEffect(() => {
    // Filter suggestions based on input
    const input = tagInput.toLowerCase();
    if (input.length > 0) {
      const filtered = COMMON_TAGS.filter(tag => 
        tag.toLowerCase().includes(input) && !formData.tags.includes(tag)
      );
      setSuggestedTags(filtered.slice(0, 5));
    } else {
      setSuggestedTags([]);
    }
  }, [tagInput, formData.tags]);

  const handleSave = async () => {
    const updates: Partial<ImageMetadata> = {
      caption: formData.caption.vi || formData.caption.en ? formData.caption : undefined,
      description: formData.description.vi || formData.description.en ? formData.description : undefined,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
    };
    
    await onSave(updates);
  };

  const addTag = (tag: string) => {
    const currentTags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (!currentTags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...currentTags, tag].join(', '),
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    const currentTags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);
    const filtered = currentTags.filter(tag => tag !== tagToRemove);
    setFormData(prev => ({
      ...prev,
      tags: filtered.join(', '),
    }));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-900">
          {t('Edit Image Details', 'Chỉnh sửa chi tiết ảnh')}
        </h2>
        <button
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Image Preview */}
      <div className="mb-6">
        <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden">
          <img
            src={image.url}
            alt={image.caption?.[language] || image.originalName}
            className="w-full h-full object-contain"
          />
        </div>
        <div className="mt-2 text-sm text-slate-600">
          {image.originalName} • {image.width} × {image.height} • {(image.size / 1024 / 1024).toFixed(2)} MB
        </div>
      </div>

      {/* Caption */}
      <div className="mb-6">
        <BilingualForm
          title={t('Caption', 'Tiêu đề')}
          value={formData.caption}
          onChange={(caption) => setFormData({ ...formData, caption })}
          placeholder={{
            vi: 'Nhập tiêu đề tiếng Việt...',
            en: 'Enter English caption...'
          }}
          type="input"
        />
      </div>

      {/* Description */}
      <div className="mb-6">
        <BilingualForm
          title={t('Description', 'Mô tả')}
          value={formData.description}
          onChange={(description) => setFormData({ ...formData, description })}
          placeholder={{
            vi: 'Nhập mô tả tiếng Việt...',
            en: 'Enter English description...'
          }}
          type="textarea"
        />
      </div>

      {/* Tags */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {t('Tags', 'Thẻ')}
        </label>
        
        {/* Tag Input */}
        <div className="relative">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && tagInput.trim()) {
                e.preventDefault();
                addTag(tagInput.trim());
              }
            }}
            placeholder={t('Add tags...', 'Thêm thẻ...')}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
          
          {/* Tag Suggestions */}
          {suggestedTags.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg">
              {suggestedTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => addTag(tag)}
                  className="w-full px-4 py-2 text-left hover:bg-slate-50 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Current Tags */}
        {formData.tags && (
          <div className="mt-3 flex flex-wrap gap-2">
            {formData.tags.split(',').map(tag => tag.trim()).filter(Boolean).map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-3 py-1 bg-brand-100 text-brand-700 rounded-full text-sm"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="hover:text-brand-900"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Common Tags */}
        <div className="mt-4">
          <p className="text-sm text-slate-600 mb-2">
            {t('Common tags:', 'Thẻ phổ biến:')}
          </p>
          <div className="flex flex-wrap gap-2">
            {COMMON_TAGS.slice(0, 10).map(tag => (
              <button
                key={tag}
                onClick={() => addTag(tag)}
                className="px-3 py-1 text-sm bg-slate-100 text-slate-700 rounded-full hover:bg-slate-200 transition-colors"
                disabled={formData.tags.includes(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <button
          onClick={onCancel}
          className="px-6 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
        >
          {t('Cancel', 'Hủy')}
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-6 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {t('Saving...', 'Đang lưu...')}
            </span>
          ) : (
            t('Save', 'Lưu')
          )}
        </button>
      </div>
    </div>
  );
}
