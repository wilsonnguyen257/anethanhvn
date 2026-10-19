import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface OfflineContextType {
  isOnline: boolean;
  isOffline: boolean;
  offlineQueue: Array<{
    id: string;
    type: string;
    data: unknown;
    timestamp: number;
  }>;
  addToOfflineQueue: (type: string, data: unknown) => void;
  clearOfflineQueue: () => void;
  syncOfflineQueue: () => Promise<void>;
  lastSyncTime: number | null;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}

interface OfflineProviderProps {
  children: ReactNode;
}

export function OfflineProvider({ children }: OfflineProviderProps) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [offlineQueue, setOfflineQueue] = useState<Array<{
    id: string;
    type: string;
    data: unknown;
    timestamp: number;
  }>>([]);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  // Load offline queue from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('offlineQueue');
        if (saved) {
          setOfflineQueue(JSON.parse(saved));
        }
        
        const savedSyncTime = localStorage.getItem('lastSyncTime');
        if (savedSyncTime) {
          setLastSyncTime(parseInt(savedSyncTime));
        }
      } catch (error) {
        console.error('Failed to load offline queue:', error);
      }
    }
  }, []);

  // Save offline queue to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
      } catch (error) {
        console.error('Failed to save offline queue:', error);
      }
    }
  }, [offlineQueue]);

  // The online listener is registered once, so it reads the latest sync
  // function (and therefore the latest queue) through a ref.
  const syncRef = useRef<() => Promise<void>>(async () => {});

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Attempt to sync when coming back online
      syncRef.current();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Add item to offline queue
  const addToOfflineQueue = (type: string, data: unknown) => {
    const item = {
      id: Date.now().toString() + Math.random().toString(36).substr(2),
      type,
      data,
      timestamp: Date.now(),
    };

    setOfflineQueue(prev => [...prev, item]);

    // Show notification (optional)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Offline Mode', {
        body: 'Your changes will be synced when you\'re back online.',
        icon: '/favicon.ico',
      });
    }
  };

  // Clear offline queue
  const clearOfflineQueue = () => {
    setOfflineQueue([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('offlineQueue');
    }
  };

  // Sync offline queue
  const syncOfflineQueue = async () => {
    if (!isOnline || offlineQueue.length === 0) {
      return;
    }

    try {
      // Process each item in the queue
      for (const item of offlineQueue) {
        switch (item.type) {
          case 'saveEvent':
            // Sync event
            await fetch('/api/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.data),
            });
            break;
            
          case 'saveReflection':
            // Sync reflection
            await fetch('/api/reflections', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.data),
            });
            break;
            
          case 'saveGalleryImage':
            // Sync gallery image
            await fetch('/api/gallery/images', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.data),
            });
            break;
            
          case 'deleteItem': {
            // Sync deletion
            const { type, id } = item.data as { type: string; id: string };
            await fetch(`/api/${type}/${id}`, {
              method: 'DELETE',
            });
            break;
          }
            
          default:
            console.warn('Unknown offline queue item type:', item.type);
        }
      }

      // Clear queue after successful sync
      clearOfflineQueue();
      setLastSyncTime(Date.now());
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastSyncTime', Date.now().toString());
      }

      // Show success notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Sync Complete', {
          body: 'All your changes have been synced.',
          icon: '/favicon.ico',
        });
      }
    } catch (error) {
      console.error('Failed to sync offline queue:', error);
    }
  };
  syncRef.current = syncOfflineQueue;

  const value: OfflineContextType = {
    isOnline,
    isOffline: !isOnline,
    offlineQueue,
    addToOfflineQueue,
    clearOfflineQueue,
    syncOfflineQueue,
    lastSyncTime,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

// Offline status indicator component
export function OfflineStatus() {
  const { isOnline, isOffline, offlineQueue, syncOfflineQueue } = useOffline();

  if (isOnline && offlineQueue.length === 0) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 max-w-sm`}>
      <div className={`rounded-lg shadow-lg p-4 ${
        isOffline ? 'bg-orange-50 border border-orange-200' : 'bg-blue-50 border border-blue-200'
      }`}>
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-5 h-5 mt-0.5 ${
            isOffline ? 'text-orange-600' : 'text-blue-600'
          }`}>
            {isOffline ? (
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${
              isOffline ? 'text-orange-800' : 'text-blue-800'
            }`}>
              {isOffline ? 'You are offline' : 'Syncing changes...'}
            </p>
            <p className={`text-sm mt-1 ${
              isOffline ? 'text-orange-700' : 'text-blue-700'
            }`}>
              {isOffline 
                ? `${offlineQueue.length} change${offlineQueue.length !== 1 ? 's' : ''} will sync when you're back online.`
                : `${offlineQueue.length} item${offlineQueue.length !== 1 ? 's' : ''} syncing...`
              }
            </p>
          </div>
          
          {isOnline && offlineQueue.length > 0 && (
            <button
              onClick={syncOfflineQueue}
              className="flex-shrink-0 px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 transition-colors"
            >
              Sync Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Higher-order component for offline-aware components
export function withOfflineSupport<P extends object>(
  Component: React.ComponentType<P & { isOffline?: boolean }>
) {
  return function WrappedComponent(props: P) {
    const { isOffline } = useOffline();
    return <Component {...props} isOffline={isOffline} />;
  };
}
