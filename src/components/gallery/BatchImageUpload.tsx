import { useState, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { batchUploadImages, validateImageFile, formatFileSize, DEFAULT_GALLERY_SETTINGS } from '../../lib/gallery';
import type { ImageMetadata, UploadProgress } from '../../types/gallery';

interface BatchImageUploadProps {
  onUploadComplete?: (images: ImageMetadata[]) => void;
  maxFiles?: number;
  albumId?: string;
}

export default function BatchImageUpload({ 
  onUploadComplete, 
  maxFiles = 50
}: BatchImageUploadProps) {
  const { language } = useLanguage();
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [uploading, setUploading] = useState(false);

  const t = (en: string, vi: string) => language === 'vi' ? vi : en;

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Process files
  const handleFiles = useCallback((newFiles: File[]) => {
    // Filter valid image files
    const validFiles = newFiles.filter(file => {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        console.warn(`Skipping ${file.name}: ${validation.error}`);
        return false;
      }
      return true;
    });

    // Check max files limit
    const totalFiles = files.length + validFiles.length;
    if (totalFiles > maxFiles) {
      alert(language === 'vi' ? `Tối đa ${maxFiles} tệp được phép` : `Maximum ${maxFiles} files allowed`);
      return;
    }

    setFiles(prev => [...prev, ...validFiles]);
  }, [files.length, maxFiles, language]);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, [handleFiles]);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  }, [handleFiles]);

  // Remove file
  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Clear all files
  const clearFiles = useCallback(() => {
    setFiles([]);
    setUploads([]);
  }, []);

  // Start upload
  const startUpload = useCallback(async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    setUploads([]);
    
    try {
      await batchUploadImages(
        files,
        (progress) => {
          setUploads(prev => {
            const existing = prev.findIndex(u => u.filename === progress.filename);
            if (existing >= 0) {
              const newUploads = [...prev];
              newUploads[existing] = progress;
              return newUploads;
            }
            return [...prev, progress];
          });
        },
        (completedImages) => {
          onUploadComplete?.(completedImages);
          clearFiles();
        }
      );
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  }, [files, onUploadComplete, clearFiles]);

  return (
    <div className="w-full">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive 
            ? 'border-brand-500 bg-brand-50' 
            : 'border-slate-300 hover:border-slate-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept={DEFAULT_GALLERY_SETTINGS.allowedFormats.map(f => `.${f}`).join(',')}
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading}
        />
        
        <div className="space-y-4">
          <div className="text-slate-400">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          
          <div>
            <p className="text-lg font-medium text-slate-900">
              {t('Drop images here', 'Thả ảnh vào đây')}
            </p>
            <p className="text-sm text-slate-600">
              {t('or click to select', 'hoặc nhấp để chọn')}
            </p>
          </div>
          
          <div className="text-xs text-slate-400">
            <p>{t('Supported formats', 'Định dạng hỗ trợ')}: {DEFAULT_GALLERY_SETTINGS.allowedFormats.join(', ')}</p>
            <p>{t('Max file size', 'Kích thước tối đa')}: {formatFileSize(DEFAULT_GALLERY_SETTINGS.maxFileSize)}</p>
            <p>{t('Max files', 'Số tệp tối đa')}: {maxFiles}</p>
          </div>
        </div>
      </div>

      {/* Selected Files */}
      {files.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-slate-900">
              {t('Selected Files', 'Tệp đã chọn')} ({files.length})
            </h3>
            <button
              onClick={clearFiles}
              className="text-sm text-slate-600 hover:text-slate-700"
            >
              {t('Clear All', 'Xóa tất cả')}
            </button>
          </div>
          
          <div className="space-y-2">
            {files.map((file, index) => (
              <div key={index} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                <div className="w-12 h-12 bg-slate-200 rounded overflow-hidden">
                  <img
                    src={URL.createObjectURL(file)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-600">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 text-slate-400 hover:text-red-500"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          
          {/* Upload Button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={startUpload}
              disabled={uploading}
              className="px-6 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('Uploading...', 'Đang tải lên...')}
                </span>
              ) : (
                t(`Upload ${files.length} Files`, `Tải lên ${files.length} tệp`)
              )}
            </button>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-slate-900 mb-4">
            {t('Upload Progress', 'Tiến trình tải lên')}
          </h3>
          
          <div className="space-y-3">
            {uploads.map((upload) => (
              <div key={upload.id} className="p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  {upload.preview && (
                    <div className="w-10 h-10 bg-slate-200 rounded overflow-hidden">
                      <img
                        src={upload.preview}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {upload.filename}
                    </p>
                    <p className="text-xs text-slate-600">
                      {upload.status === 'completed' && t('Completed', 'Hoàn thành')}
                      {upload.status === 'error' && upload.error}
                      {upload.status === 'uploading' && `${upload.progress}%`}
                    </p>
                  </div>
                  
                  <div className="w-16 text-right">
                    {upload.status === 'uploading' && (
                      <span className="text-sm font-medium text-brand-600">
                        {upload.progress}%
                      </span>
                    )}
                    {upload.status === 'completed' && (
                      <svg className="w-5 h-5 text-green-500 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                    {upload.status === 'error' && (
                      <svg className="w-5 h-5 text-red-500 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
                
                {upload.status === 'uploading' && (
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-brand-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
