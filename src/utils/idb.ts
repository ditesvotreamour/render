
const DB_NAME = 'SpecterrAudioDB';
const STORE_NAME = 'tracks';
const LIBRARY_STORE = 'track_library';

export interface StoredTrackItem {
  id: string;
  title: string;
  artist: string;
  duration: number;
  file: File | Blob;
  lyrics?: any[];
  createdAt: number;
  isCut?: boolean;
  cutRange?: { start: number; end: number };
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(LIBRARY_STORE)) {
        db.createObjectStore(LIBRARY_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCustomTrack(file: File, trackMeta: any, lyrics?: any[]): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ file, trackMeta, lyrics: lyrics || [] }, 'current_custom_track');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to save track to IDB:', err);
  }
}

export async function updateCustomTrackLyrics(lyrics: any[], trackTitle?: string, trackId?: string): Promise<void> {
  try {
    const db = await getDB();
    // 1. Update current_custom_track in STORE_NAME only if matching or unspecified
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('current_custom_track');
      req.onsuccess = () => {
        const data = req.result;
        if (data) {
          const matchTitle = !trackTitle || !data.trackMeta?.title || data.trackMeta.title.trim().toLowerCase() === trackTitle.trim().toLowerCase();
          if (matchTitle) {
            data.lyrics = lyrics;
            store.put(data, 'current_custom_track');
          }
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });

    // 2. Also synchronize to LIBRARY_STORE for the matching track
    if (trackTitle || trackId) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(LIBRARY_STORE, 'readwrite');
          const store = tx.objectStore(LIBRARY_STORE);
          const req = store.getAll();
          req.onsuccess = () => {
            const items: StoredTrackItem[] = req.result || [];
            if (items.length > 0) {
              for (const item of items) {
                const matchId = trackId && item.id === trackId;
                const matchTitle =
                  trackTitle &&
                  item.title &&
                  item.title.trim().toLowerCase() === trackTitle.trim().toLowerCase();
                if (matchId || matchTitle) {
                  item.lyrics = lyrics;
                  store.put(item);
                }
              }
            }
            resolve();
          };
          req.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch (err) {
    console.error('Failed to update lyrics in IDB:', err);
  }
}

export async function updateLibraryTrackLyrics(trackTitleOrId: string, lyrics: any[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(LIBRARY_STORE, 'readwrite');
    const store = tx.objectStore(LIBRARY_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const items: StoredTrackItem[] = req.result || [];
      for (const item of items) {
        if (
          item.id === trackTitleOrId ||
          (item.title && item.title.trim().toLowerCase() === trackTitleOrId.trim().toLowerCase())
        ) {
          item.lyrics = lyrics;
          store.put(item);
        }
      }
    };
  } catch (err) {
    console.error('Failed to update library track lyrics:', err);
  }
}

export async function loadCustomTrack(): Promise<{ file: File; trackMeta: any; lyrics?: any[] } | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get('current_custom_track');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to load track from IDB:', err);
    return null;
  }
}

export async function clearCustomTrack(): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete('current_custom_track');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to clear track from IDB:', err);
  }
}

/**
 * Save track / cut item to the persistent Track Library
 */
export async function saveTrackToLibrary(item: StoredTrackItem): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LIBRARY_STORE, 'readwrite');
      tx.objectStore(LIBRARY_STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to save track to library:', err);
  }
}

/**
 * Get all saved tracks and cuts from the persistent Track Library
 */
export async function getAllTracksFromLibrary(): Promise<StoredTrackItem[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LIBRARY_STORE, 'readonly');
      const store = tx.objectStore(LIBRARY_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const items: StoredTrackItem[] = req.result || [];
        items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to get track library:', err);
    return [];
  }
}

/**
 * Delete a track / cut from the persistent Track Library
 */
export async function deleteTrackFromLibrary(id: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LIBRARY_STORE, 'readwrite');
      tx.objectStore(LIBRARY_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to delete track from library:', err);
  }
}

/**
 * Clear all tracks and cuts from the persistent Track Library
 */
export async function clearAllTracksFromLibrary(): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LIBRARY_STORE, 'readwrite');
      tx.objectStore(LIBRARY_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to clear track library:', err);
  }
}

