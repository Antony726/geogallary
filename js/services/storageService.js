/**
 * Unified Storage Service
 * Manages IndexedDB persistence, Web File System Access API (real disk folders),
 * and ZIP hierarchy export.
 */

import { CONFIG, SAMPLE_MEMORIES } from '../config.js';

class StorageService {
  constructor() {
    this.db = null;
    this.localDirHandle = null;
    this.isInitialized = false;
  }

  /**
   * Initialize IndexedDB database
   */
  async init() {
    if (this.isInitialized && this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Media store
        if (!db.objectStoreNames.contains('media')) {
          const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
          mediaStore.createIndex('dateTaken', 'dateTaken', { unique: false });
          mediaStore.createIndex('locationName', 'locationName', { unique: false });
          mediaStore.createIndex('yearMonth', 'yearMonth', { unique: false });
          mediaStore.createIndex('mediaType', 'mediaType', { unique: false });
        }

        // Trips store (Feature 2)
        if (!db.objectStoreNames.contains('trips')) {
          const tripStore = db.createObjectStore('trips', { keyPath: 'id' });
          tripStore.createIndex('startDate', 'startDate', { unique: false });
        }

        // SW Photo Cache (Feature 5)
        if (!db.objectStoreNames.contains('sw-photo-cache')) {
          db.createObjectStore('sw-photo-cache', { keyPath: 'id' });
        }

        // Settings / metadata store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        this.isInitialized = true;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Seed high-quality initial demo memories
   */
  async seedSampleMemories() {
    for (const item of SAMPLE_MEMORIES) {
      await this.saveMedia(item);
    }
  }

  /**
   * Save a media item into IndexedDB and optionally into Local Disk directory
   */
  async saveMedia(item) {
    await this.init();

    // Ensure standard date hierarchy fields
    if (item.dateTaken) {
      const d = new Date(item.dateTaken);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear().toString();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        item.year = yyyy;
        item.yearMonth = `${yyyy}-${mm}`;
        item.day = `${yyyy}-${mm}-${dd}`;
      }
    }
    if (!item.year) item.year = 'Unspecified Year';
    if (!item.yearMonth) item.yearMonth = 'Unspecified Month';
    if (!item.day) item.day = 'Unspecified Date';
    if (!item.locationName) item.locationName = 'Unspecified Location';

    // Sanitize folder names for file system compatibility
    const safeLocation = item.locationName.replace(/[<>:"/\\|?*]/g, '_').trim();
    item.storagePath = `${safeLocation}/${item.yearMonth}/${item.fileName}`;

    // If local directory handle is active, write physical file to disk
    if (this.localDirHandle && item.fileBlob) {
      try {
        await this.writeToLocalDiskHierarchy(safeLocation, item.yearMonth, item.fileName, item.fileBlob);
      } catch (err) {
        console.warn('Could not write to local disk handle:', err);
      }
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['media'], 'readwrite');
      const store = tx.objectStore('media');
      const req = store.put(item);

      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Write file to physical local disk using File System Access API
   * Path: [Target Directory] / [Location] / [YYYY-MM] / [fileName]
   */
  async writeToLocalDiskHierarchy(locationFolder, monthFolder, fileName, fileBlob) {
    if (!this.localDirHandle) return;

    // 1. Get or create Location directory
    const locDir = await this.localDirHandle.getDirectoryHandle(locationFolder, { create: true });
    
    // 2. Get or create YYYY-MM subfolder
    const monthDir = await locDir.getDirectoryHandle(monthFolder, { create: true });

    // 3. Create file and write blob content
    const fileHandle = await monthDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(fileBlob);
    await writable.close();
  }

  /**
   * Prompt user to pick a local target directory on their computer
   */
  async pickLocalDirectory() {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('Web File System Access API is not supported in this browser. Please use Chrome, Edge, or Opera.');
    }

    this.localDirHandle = await window.showDirectoryPicker({
      mode: 'readwrite'
    });

    localStorage.setItem(CONFIG.STORAGE_KEYS.LOCAL_ROOT_NAME, this.localDirHandle.name);
    return this.localDirHandle.name;
  }

  /**
   * Retrieve all media items sorted by date taken (newest first)
   */
  async getAllMedia() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['media'], 'readonly');
      const store = tx.objectStore('media');
      const req = store.getAll();

      req.onsuccess = () => {
        const items = req.result || [];
        // Sort descending by dateTaken
        items.sort((a, b) => new Date(b.dateTaken) - new Date(a.dateTaken));
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get single media by ID
   */
  async getMediaById(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['media'], 'readonly');
      const store = tx.objectStore('media');
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Delete media item by ID
   */
  async deleteMedia(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['media'], 'readwrite');
      const store = tx.objectStore('media');
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Count total media records
   */
  async getMediaCount() {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction(['media'], 'readonly');
      const store = tx.objectStore('media');
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  }

  /**
   * Get Organized Folder Tree Structure:
   * Location -> Year-Month -> Files[]
   */
  async getFolderHierarchy() {
    const all = await this.getAllMedia();
    const tree = {};

    for (const item of all) {
      const loc = item.locationName || 'Unspecified Location';
      const ym = item.yearMonth || 'Unknown Date';

      if (!tree[loc]) {
        tree[loc] = {
          locationName: loc,
          city: item.city,
          country: item.country,
          totalFiles: 0,
          totalSize: 0,
          months: {}
        };
      }

      if (!tree[loc].months[ym]) {
        tree[loc].months[ym] = {
          yearMonth: ym,
          files: [],
          size: 0
        };
      }

      tree[loc].months[ym].files.push(item);
      tree[loc].months[ym].size += (item.fileSize || 0);
      tree[loc].totalFiles += 1;
      tree[loc].totalSize += (item.fileSize || 0);
    }

    return tree;
  }

  /**
   * Calculate storage analytics summary
   */
  async getAnalytics() {
    const media = await this.getAllMedia();
    const totalCount = media.length;
    let photoCount = 0;
    let videoCount = 0;
    let totalBytes = 0;
    
    const uniqueLocations = new Set();
    const uniqueCities = new Set();
    const uniqueCountries = new Set();
    const monthlyActivity = {}; // 'YYYY-MM': count
    const yearlyActivity = {};  // 'YYYY': count

    let oldestDate = null;
    let newestDate = null;

    for (const item of media) {
      if (item.mediaType === 'video') videoCount++;
      else photoCount++;

      totalBytes += (item.fileSize || 0);

      if (item.locationName) uniqueLocations.add(item.locationName);
      if (item.city && item.city !== 'Unknown City') uniqueCities.add(item.city);
      if (item.country && item.country !== 'Unknown Country') uniqueCountries.add(item.country);

      if (item.yearMonth) {
        monthlyActivity[item.yearMonth] = (monthlyActivity[item.yearMonth] || 0) + 1;
      }
      if (item.year) {
        yearlyActivity[item.year] = (yearlyActivity[item.year] || 0) + 1;
      }

      if (item.dateTaken) {
        const time = new Date(item.dateTaken).getTime();
        if (!oldestDate || time < oldestDate) oldestDate = time;
        if (!newestDate || time > newestDate) newestDate = time;
      }
    }

    return {
      totalCount,
      photoCount,
      videoCount,
      totalBytes,
      locationCount: uniqueLocations.size,
      cityCount: uniqueCities.size,
      countryCount: uniqueCountries.size,
      monthlyActivity,
      yearlyActivity,
      oldestDate: oldestDate ? new Date(oldestDate).toISOString() : null,
      newestDate: newestDate ? new Date(newestDate).toISOString() : null
    };
  }

  /**
   * Export all media organized into a ZIP file preserving:
   * Location / YYYY-MM / filename
   */
  async exportAsZip(filterMediaList = null) {
    if (typeof window.JSZip === 'undefined') {
      throw new Error('JSZip library is not available');
    }

    const zip = new window.JSZip();
    const items = filterMediaList || await this.getAllMedia();

    for (const item of items) {
      const path = item.storagePath || `${item.locationName || 'Unspecified'}/${item.yearMonth || '2024-01'}/${item.fileName}`;
      
      if (item.fileBlob) {
        zip.file(path, item.fileBlob);
      } else if (item.url) {
        try {
          const resp = await fetch(item.url);
          const blob = await resp.blob();
          zip.file(path, blob);
        } catch (e) {
          console.warn(`Could not fetch media for zip export: ${item.fileName}`);
        }
      }
    }

    return zip.generateAsync({ type: 'blob' });
  }

  /**
   * Trip Store Methods (Feature 2)
   */
  async saveTrip(trip) {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db || !this.db.objectStoreNames.contains('trips')) {
        console.warn('Trips objectStore not created in IndexedDB yet');
        resolve(trip);
        return;
      }
      const tx = this.db.transaction(['trips'], 'readwrite');
      const store = tx.objectStore('trips');
      const req = store.put(trip);
      req.onsuccess = () => resolve(trip);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllTrips() {
    await this.init();
    return new Promise((resolve) => {
      if (!this.db || !this.db.objectStoreNames.contains('trips')) {
        resolve([]);
        return;
      }
      const tx = this.db.transaction(['trips'], 'readonly');
      const store = tx.objectStore('trips');
      const req = store.getAll();
      req.onsuccess = () => {
        const trips = req.result || [];
        trips.sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0));
        resolve(trips);
      };
      req.onerror = () => resolve([]);
    });
  }

  async getTripById(id) {
    await this.init();
    return new Promise((resolve) => {
      if (!this.db || !this.db.objectStoreNames.contains('trips')) {
        resolve(null);
        return;
      }
      const tx = this.db.transaction(['trips'], 'readonly');
      const store = tx.objectStore('trips');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async deleteTrip(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db || !this.db.objectStoreNames.contains('trips')) {
        resolve(true);
        return;
      }
      const tx = this.db.transaction(['trips'], 'readwrite');
      const store = tx.objectStore('trips');
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async updateTrip(id, updates) {
    const trip = await this.getTripById(id);
    if (!trip) return null;
    const updated = { ...trip, ...updates };
    return this.saveTrip(updated);
  }
}

export const storageService = new StorageService();

