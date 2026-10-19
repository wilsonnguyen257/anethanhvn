import { useState, useCallback } from 'react';
import { getJson, saveJson } from '../lib/storage';
import type { ImageMetadata, Album, GalleryViewOptions } from '../types/gallery';

export function useGallery() {
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<ImageMetadata[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [viewOptions, setViewOptions] = useState<GalleryViewOptions>({
    layout: 'grid',
    itemsPerPage: 20,
    showTags: true,
    sortBy: 'date',
    sortOrder: 'desc',
    filterBy: {},
  });

  // Load gallery data
  const loadGallery = useCallback(async () => {
    setLoading(true);
    try {
      const [imagesData, albumsData] = await Promise.all([
        getJson<ImageMetadata[]>('gallery-images'),
        getJson<Album[]>('gallery-albums'),
      ]);
      
      setImages((imagesData || []).map(img => ({
        ...img,
        status: img.status as 'active' | 'archived' | 'deleted'
      })));
      setAlbums((albumsData || []).map(album => ({
        ...album,
        status: album.status as 'published' | 'draft' | 'deleted'
      })));
    } catch (error) {
      console.error('Failed to load gallery:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save images
  const saveImages = useCallback(async (newImages: ImageMetadata[]) => {
    try {
      await saveJson('gallery-images', newImages);
      setImages(newImages);
    } catch (error) {
      console.error('Failed to save images:', error);
      throw error;
    }
  }, []);

  // Save albums
  const saveAlbums = useCallback(async (newAlbums: Album[]) => {
    try {
      await saveJson('gallery-albums', newAlbums);
      setAlbums(newAlbums);
    } catch (error) {
      console.error('Failed to save albums:', error);
      throw error;
    }
  }, []);

  // Add image
  const addImage = useCallback(async (imageData: Omit<ImageMetadata, 'id' | 'uploadedAt'>) => {
    const newImage: ImageMetadata = {
      ...imageData,
      id: Date.now().toString(),
      uploadedAt: new Date().toISOString(),
    };
    
    const newImages = [...images, newImage];
    await saveImages(newImages);
    return newImage;
  }, [images, saveImages]);

  // Update image
  const updateImage = useCallback(async (id: string, updates: Partial<ImageMetadata>) => {
    const newImages = images.map(img => 
      img.id === id ? { ...img, ...updates } : img
    );
    await saveImages(newImages);
  }, [images, saveImages]);

  // Delete image
  const deleteImage = useCallback(async (id: string) => {
    const newImages = images.map(img => 
      img.id === id ? { ...img, status: 'deleted' } : img
    );
    await saveImages(newImages);
  }, [images, saveImages]);

  // Add album
  const addAlbum = useCallback(async (albumData: Omit<Album, 'id' | 'createdAt' | 'updatedAt' | 'metadata'>) => {
    const newAlbum: Album = {
      ...albumData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        imageCount: albumData.images.length,
        totalViews: 0,
        lastUpdated: new Date().toISOString(),
      },
    };
    
    const newAlbums = [...albums, newAlbum];
    await saveAlbums(newAlbums);
    return newAlbum;
  }, [albums, saveAlbums]);

  // Update album
  const updateAlbum = useCallback(async (id: string, updates: Partial<Album>) => {
    const newAlbums = albums.map(album => 
      album.id === id 
        ? { 
            ...album, 
            ...updates, 
            updatedAt: new Date().toISOString(),
            metadata: {
              ...album.metadata,
              ...updates.metadata,
              lastUpdated: new Date().toISOString(),
            }
          } 
        : album
    );
    await saveAlbums(newAlbums);
  }, [albums, saveAlbums]);

  // Delete album
  const deleteAlbum = useCallback(async (id: string) => {
    const newAlbums = albums.map(album => 
      album.id === id ? { ...album, status: 'deleted' } : album
    );
    await saveAlbums(newAlbums);
    
    // Remove album ID from images
    const newImages = images.map(img => 
      img.albumId === id ? { ...img, albumId: undefined } : img
    );
    await saveImages(newImages);
  }, [albums, images, saveAlbums, saveImages]);

  // Add images to album
  const addImagesToAlbum = useCallback(async (albumId: string, imageIds: string[]) => {
    await updateAlbum(albumId, {
      images: [...(albums.find(a => a.id === albumId)?.images || []), ...imageIds],
    });
    
    // Update album ID on images
    const newImages = images.map(img => 
      imageIds.includes(img.id) ? { ...img, albumId } : img
    );
    await saveImages(newImages);
  }, [albums, images, updateAlbum, saveImages]);

  // Remove images from album
  const removeImagesFromAlbum = useCallback(async (albumId: string, imageIds: string[]) => {
    const album = albums.find(a => a.id === albumId);
    if (!album) return;
    
    await updateAlbum(albumId, {
      images: album.images.filter(item => 
      typeof item === 'string' ? !imageIds.includes(item) : !imageIds.includes(item.id)
    ),
    });
    
    // Remove album ID from images
    const newImages = images.map(img => 
      imageIds.includes(img.id) ? { ...img, albumId: undefined } : img
    );
    await saveImages(newImages);
  }, [albums, images, updateAlbum, saveImages]);

  // Get album images
  const getAlbumImages = useCallback((albumId: string) => {
    const album = albums.find(a => a.id === albumId);
    if (!album) return [];
    
    return images
      .filter(img => album.images.includes(img.id) && img.status === 'active')
      .sort((a, b) => {
        const indexA = album.images.indexOf(a.id);
        const indexB = album.images.indexOf(b.id);
        return indexA - indexB;
      });
  }, [albums, images]);

  // Get unorganized images (not in any album)
  const getUnorganizedImages = useCallback(() => {
    return images.filter(img => !img.albumId && img.status === 'active');
  }, [images]);

  // Search images
  const searchImages = useCallback((query: string) => {
    const searchTerm = query.toLowerCase();
    
    return images.filter(image => {
      if (image.status !== 'active') return false;
      
      // Search in filename
      if (image.originalName.toLowerCase().includes(searchTerm)) {
        return true;
      }
      
      // Search in caption
      if (image.caption?.vi?.toLowerCase().includes(searchTerm) || 
          image.caption?.en?.toLowerCase().includes(searchTerm)) {
        return true;
      }
      
      // Search in tags
      if (image.tags.some(tag => tag.toLowerCase().includes(searchTerm))) {
        return true;
      }
      
      return false;
    });
  }, [images]);

  // Get all unique tags
  const getAllTags = useCallback(() => {
    const tagSet = new Set<string>();
    images.forEach(img => {
      img.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [images]);

  return {
    loading,
    images,
    albums,
    viewOptions,
    setViewOptions,
    loadGallery,
    addImage,
    updateImage,
    deleteImage,
    addAlbum,
    updateAlbum,
    deleteAlbum,
    addImagesToAlbum,
    removeImagesFromAlbum,
    getAlbumImages,
    getUnorganizedImages,
    searchImages,
    getAllTags,
    saveImages,
    saveAlbums,
  };
}
