export interface ImageMetadata {
  id: string;
  url: string;
  name: string;
  originalName: string;
  filename?: string;
  description?: {
    en: string;
    vi: string;
  };
  caption?: {
    en: string;
    vi: string;
  };
  tags: string[];
  uploadedAt: string;
  size: number;
  dimensions?: {
    width: number;
    height: number;
  };
  width?: number;
  height?: number;
  albumId?: string;
  type?: string;
  format?: string;
  status?: 'active' | 'inactive' | string;
  thumbnailUrl?: string;
  order?: number;
}

export interface UploadProgress {
  file?: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'completed';
  error?: string;
  url?: string;
  metadata?: ImageMetadata;
  loaded?: number;
  total?: number;
  percentage?: number;
  id?: string;
  filename?: string;
  preview?: string;
}

export interface Album {
  id: string;
  name: {
    en: string;
    vi: string;
  };
  title?: {
    en: string;
    vi: string;
  };
  description?: {
    en: string;
    vi: string;
  };
  images: (string | ImageMetadata)[];
  coverImage?: string;
  createdAt: string;
  updatedAt: string;
  status?: 'published' | 'draft' | string;
  settings?: {
    isPublic: boolean;
    allowDownloads: boolean;
  };
  metadata?: {
    imageCount?: number;
    lastUpdated: string;
    totalViews?: number;
  };
}

export interface GalleryViewOptions {
  layout: 'grid' | 'masonry' | 'list';
  itemsPerPage: number;
  showTags: boolean;
  sortBy: 'date' | 'name' | 'size';
  sortOrder: 'asc' | 'desc';
  filterBy?: Record<string, unknown>;
}