import {
  UserAcademicProfile,
  AcademicPosition,
  MasteryRecord,
  MistakeItem,
  PersonalizedTextbook,
  VaultFileRecord,
  StudySession,
  SubjectName,
} from '../types';

const DB_NAME = 'ishizaki_academic_os';
const DB_VERSION = 1;

export interface SyncQueueItem {
  id: string;
  collection: string;
  docId: string;
  action: 'UPSERT' | 'DELETE';
  payload: any;
  timestamp: string;
}

class IshizakiIndexedDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile', { keyPath: 'userId' });
        }
        if (!db.objectStoreNames.contains('positions')) {
          db.createObjectStore('positions', { keyPath: 'subject' });
        }
        if (!db.objectStoreNames.contains('mastery')) {
          const masteryStore = db.createObjectStore('mastery', { keyPath: 'nodeId' });
          masteryStore.createIndex('subject', 'subject', { unique: false });
          masteryStore.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains('mistakes')) {
          const mistakeStore = db.createObjectStore('mistakes', { keyPath: 'id' });
          mistakeStore.createIndex('subject', 'subject', { unique: false });
          mistakeStore.createIndex('resolved', 'resolved', { unique: false });
        }
        if (!db.objectStoreNames.contains('textbooks')) {
          const tbStore = db.createObjectStore('textbooks', { keyPath: 'id' });
          tbStore.createIndex('subject', 'subject', { unique: false });
          tbStore.createIndex('nodeId', 'nodeId', { unique: false });
        }
        if (!db.objectStoreNames.contains('vault_files')) {
          const vfStore = db.createObjectStore('vault_files', { keyPath: 'id' });
          vfStore.createIndex('folder', 'folder', { unique: false });
          vfStore.createIndex('offlineCached', 'offlineCached', { unique: false });
        }
        if (!db.objectStoreNames.contains('vault_blobs')) {
          db.createObjectStore('vault_blobs', { keyPath: 'fileId' });
        }
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('subject', 'subject', { unique: false });
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.initPromise;
  }

  // --- Profile ---
  async getProfile(): Promise<UserAcademicProfile | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('profile', 'readonly');
      const store = tx.objectStore('profile');
      const req = store.getAll();
      req.onsuccess = () => {
        resolve(req.result && req.result.length > 0 ? req.result[0] : null);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async saveProfile(profile: UserAcademicProfile): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['profile', 'sync_queue'], 'readwrite');
      tx.objectStore('profile').put(profile);
      this.enqueueSyncInTx(tx, 'profile', profile.userId, 'UPSERT', profile);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Academic Positions ---
  async getPositions(): Promise<Record<SubjectName, AcademicPosition>> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('positions', 'readonly');
      const store = tx.objectStore('positions');
      const req = store.getAll();
      req.onsuccess = () => {
        const map = {} as Record<SubjectName, AcademicPosition>;
        (req.result as AcademicPosition[]).forEach((pos) => {
          map[pos.subject] = pos;
        });
        resolve(map);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async savePosition(position: AcademicPosition): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['positions', 'sync_queue'], 'readwrite');
      tx.objectStore('positions').put(position);
      this.enqueueSyncInTx(tx, 'positions', position.subject, 'UPSERT', position);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Mastery ---
  async getMasteryList(): Promise<MasteryRecord[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('mastery', 'readonly');
      const req = tx.objectStore('mastery').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async saveMastery(record: MasteryRecord): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['mastery', 'sync_queue'], 'readwrite');
      tx.objectStore('mastery').put(record);
      this.enqueueSyncInTx(tx, 'mastery', record.nodeId, 'UPSERT', record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Mistakes ---
  async getMistakes(): Promise<MistakeItem[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('mistakes', 'readonly');
      const req = tx.objectStore('mistakes').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async saveMistake(item: MistakeItem): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['mistakes', 'sync_queue'], 'readwrite');
      tx.objectStore('mistakes').put(item);
      this.enqueueSyncInTx(tx, 'mistakes', item.id, 'UPSERT', item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Textbooks ---
  async getTextbooks(): Promise<PersonalizedTextbook[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('textbooks', 'readonly');
      const req = tx.objectStore('textbooks').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getTextbook(id: string): Promise<PersonalizedTextbook | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('textbooks', 'readonly');
      const req = tx.objectStore('textbooks').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveTextbook(tb: PersonalizedTextbook): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['textbooks', 'sync_queue'], 'readwrite');
      tx.objectStore('textbooks').put(tb);
      this.enqueueSyncInTx(tx, 'textbooks', tb.id, 'UPSERT', tb);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Vault Metadata & Binary Blobs ---
  async getVaultFiles(): Promise<VaultFileRecord[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('vault_files', 'readonly');
      const req = tx.objectStore('vault_files').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async saveVaultFile(fileMeta: VaultFileRecord): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['vault_files', 'sync_queue'], 'readwrite');
      tx.objectStore('vault_files').put(fileMeta);
      this.enqueueSyncInTx(tx, 'vault_files', fileMeta.id, 'UPSERT', fileMeta);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteVaultFile(fileId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['vault_files', 'vault_blobs', 'sync_queue'], 'readwrite');
      tx.objectStore('vault_files').delete(fileId);
      tx.objectStore('vault_blobs').delete(fileId);
      this.enqueueSyncInTx(tx, 'vault_files', fileId, 'DELETE', null);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveVaultBlob(fileId: string, blobData: Blob): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('vault_blobs', 'readwrite');
      tx.objectStore('vault_blobs').put({ fileId, blobData, cachedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getVaultBlob(fileId: string): Promise<Blob | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('vault_blobs', 'readonly');
      const req = tx.objectStore('vault_blobs').get(fileId);
      req.onsuccess = () => resolve(req.result ? req.result.blobData : null);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteVaultBlob(fileId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('vault_blobs', 'readwrite');
      tx.objectStore('vault_blobs').delete(fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Sessions ---
  async getSessions(): Promise<StudySession[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const req = tx.objectStore('sessions').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async saveSession(session: StudySession): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['sessions', 'sync_queue'], 'readwrite');
      tx.objectStore('sessions').put(session);
      this.enqueueSyncInTx(tx, 'sessions', session.id, 'UPSERT', session);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Sync Queue Helpers ---
  private enqueueSyncInTx(
    tx: IDBTransaction,
    collection: string,
    docId: string,
    action: 'UPSERT' | 'DELETE',
    payload: any
  ) {
    const syncItem: SyncQueueItem = {
      id: `${collection}_${docId}_${Date.now()}`,
      collection,
      docId,
      action,
      payload,
      timestamp: new Date().toISOString(),
    };
    tx.objectStore('sync_queue').put(syncItem);
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const req = tx.objectStore('sync_queue').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async removeSyncItem(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getStorageEstimate(): Promise<{ usedBytes: number; quotaBytes: number; percentUsed: number }> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const usedBytes = estimate.usage || 0;
      const quotaBytes = estimate.quota || 10 * 1024 * 1024 * 1024; // Default 10GB
      const percentUsed = quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0;
      return { usedBytes, quotaBytes, percentUsed };
    }
    return { usedBytes: 0, quotaBytes: 10 * 1024 * 1024 * 1024, percentUsed: 0 };
  }
}

export const idb = new IshizakiIndexedDB();
