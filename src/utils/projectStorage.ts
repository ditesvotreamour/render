import type {
  VisualizerConfig,
  CenterLogoConfig,
  BackgroundConfig,
  ParticlesConfig,
  TypographyConfig,
  SubtitleConfig,
  EffectsConfig,
  AspectRatio,
} from '../types/visualizer';

export interface SavedProjectData {
  version: number;
  updatedAt: number;
  aspectRatio: AspectRatio;
  currentPresetId: string;
  visualizer: VisualizerConfig;
  centerLogo: CenterLogoConfig;
  background: BackgroundConfig;
  particles: ParticlesConfig;
  typography: TypographyConfig;
  subtitle: SubtitleConfig;
  effects: EffectsConfig;
}

const STORAGE_KEY = 'specterr_local_project_backup';
const DB_NAME = 'SpecterrProjectDB';
const STORE_NAME = 'project_state';

function getProjectDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save complete visualizer project state to IndexedDB and localStorage
 */
export async function saveProjectLocally(data: Omit<SavedProjectData, 'version' | 'updatedAt'>): Promise<void> {
  const fullData: SavedProjectData = {
    ...data,
    version: 1,
    updatedAt: Date.now(),
  };

  // 1. Save to localStorage for quick synchronous checks
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fullData));
  } catch (err) {
    console.warn('LocalStorage quota reached, relying on IndexedDB:', err);
  }

  // 2. Save full payload to IndexedDB
  try {
    const db = await getProjectDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(fullData, 'current_active_project');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to save project to IndexedDB:', err);
  }
}

/**
 * Load complete visualizer project state from IndexedDB or localStorage
 */
export async function loadProjectLocally(): Promise<SavedProjectData | null> {
  try {
    const db = await getProjectDB();
    const idbResult = await new Promise<SavedProjectData | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get('current_active_project');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (idbResult) {
      return idbResult;
    }
  } catch (err) {
    console.warn('Failed to load project from IndexedDB, trying localStorage:', err);
  }

  try {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      return JSON.parse(local) as SavedProjectData;
    }
  } catch (err) {
    console.error('Failed to load project from localStorage:', err);
  }

  return null;
}

/**
 * Clear saved project from both IndexedDB and localStorage
 */
export async function clearProjectLocally(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
  try {
    const db = await getProjectDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete('current_active_project');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to clear project in IndexedDB:', err);
  }
}
