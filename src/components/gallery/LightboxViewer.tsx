import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import type { ImageMetadata } from '../../types/gallery';

interface LightboxViewerProps {
  images: ImageMetadata[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  allowDownloads?: boolean;
}

export default function LightboxViewer({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
  allowDownloads = true,
}: LightboxViewerProps) {
  const { language } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const t = (en: string, vi: string) => language === 'vi' ? vi : en;

  const currentImage = images[currentIndex];

  // Reset index when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, initialIndex]);

  // Navigation functions
  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const navigatePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      resetZoom();
    }
  }, [currentIndex, resetZoom]);

  const navigateNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetZoom();
    }
  }, [currentIndex, images.length, resetZoom]);

  // Zoom functions
  const handleZoom = useCallback((delta: number) => {
    setScale(prevScale => Math.min(Math.max(0.5, prevScale + delta), 3));
  }, []);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart, scale]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (scale > 1 && e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  }, [scale, position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDragging && scale > 1 && e.touches.length === 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart, scale]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          navigatePrevious();
          break;
        case 'ArrowRight':
          navigateNext();
          break;
        case 'Escape':
          onClose();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case '+':
        case '=':
          handleZoom(0.1);
          break;
        case '-':
        case '_':
          handleZoom(-0.1);
          break;
        case '0':
          resetZoom();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, navigatePrevious, navigateNext, onClose, toggleFullscreen, handleZoom, resetZoom]);

  // Download image
  const handleDownload = useCallback(() => {
    if (currentImage && allowDownloads) {
      const link = document.createElement('a');
      link.href = currentImage.url;
      link.download = currentImage.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [currentImage, allowDownloads]);

  if (!isOpen || !currentImage) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/50 to-transparent p-4 z-20">
        <div className="flex items-center justify-between">
          <div className="text-white">
            <h3 className="text-lg font-medium">
              {currentImage.caption?.[language] || currentImage.originalName}
            </h3>
            <p className="text-sm opacity-75">
              {currentIndex + 1} / {images.length}
              {currentImage.width && currentImage.height
                ? ` • ${currentImage.width} × ${currentImage.height}`
                : ''}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-black/30 rounded-lg p-1">
              <button
                onClick={() => handleZoom(-0.1)}
                className="p-2 text-white hover:bg-white/20 rounded transition-colors"
                title="Zoom Out"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="text-white text-sm px-2">{Math.round(scale * 100)}%</span>
              <button
                onClick={() => handleZoom(0.1)}
                className="p-2 text-white hover:bg-white/20 rounded transition-colors"
                title="Zoom In"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={resetZoom}
                className="p-2 text-white hover:bg-white/20 rounded transition-colors"
                title="Reset Zoom"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            </div>

            {/* Action Buttons */}
            {allowDownloads && (
              <button
                onClick={handleDownload}
                className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                title={t('Download', 'Tải xuống')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            )}
            
            <button
              onClick={toggleFullscreen}
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              title={t('Fullscreen', 'Toàn màn hình')}
            >
              {isFullscreen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              )}
            </button>
            
            <button
              onClick={onClose}
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              title={t('Close', 'Đóng')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Image Container */}
      <div 
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        <img
          src={currentImage.url}
          alt={currentImage.caption?.[language] || currentImage.originalName}
          className="max-w-full max-h-full object-contain select-none"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            transition: isDragging ? 'none' : 'transform 0.2s',
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          draggable={false}
        />
      </div>

      {/* Navigation Arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={navigatePrevious}
            disabled={currentIndex === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/30 text-white rounded-full hover:bg-black/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button
            onClick={navigateNext}
            disabled={currentIndex === images.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/30 text-white rounded-full hover:bg-black/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Bottom Bar */}
      {(currentImage.description || currentImage.tags.length > 0) && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4">
          <div className="text-white">
            {currentImage.description && (
              <p className="text-sm mb-2">
                {currentImage.description[language] || currentImage.description.vi}
              </p>
            )}
            {currentImage.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {currentImage.tags.map(tag => (
                  <span key={tag} className="px-2 py-1 bg-white/20 rounded text-xs">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
