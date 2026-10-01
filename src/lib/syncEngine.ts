import { db, auth, OperationType, handleFirestoreError } from './firebase';
import { idb, SyncQueueItem } from './indexedDB';
import { doc, setDoc, deleteDoc, getDoc, collection, getDocs } from 'firebase/firestore';

export type SyncState = 'SYNCED' | 'SYNCING' | 'OFFLINE' | 'ERROR';

type SyncListener = (state: SyncState, pendingCount: number) => void;

class SyncEngine {
  private state: SyncState = 'SYNCED';
  private listeners: Set<SyncListener> = new Set();
  private isProcessing = false;
  private pendingCount = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.updateState('SYNCING');
        this.flushQueue();
      });
      window.addEventListener('offline', () => {
        this.updateState('OFFLINE');
      });
    }
  }

  subscribe(listener: SyncListener) {
    this.listeners.add(listener);
    listener(this.state, this.pendingCount);
    return () => this.listeners.delete(listener);
  }

  private updateState(newState: SyncState) {
    this.state = newState;
    this.notify();
  }

  private notify() {
    this.listeners.forEach((l) => l(this.state, this.pendingCount));
  }

  async flushQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.updateState('OFFLINE');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      this.updateState('SYNCED');
      return;
    }

    this.isProcessing = true;
    this.updateState('SYNCING');

    try {
      const queue = await idb.getSyncQueue();
      this.pendingCount = queue.length;
      this.notify();

      for (const item of queue) {
        await this.syncItemToCloud(user.uid, item);
        await idb.removeSyncItem(item.id);
        this.pendingCount--;
        this.notify();
      }

      this.updateState('SYNCED');
    } catch (err) {
      console.warn('Sync queue flush paused:', err);
      this.updateState('ERROR');
    } finally {
      this.isProcessing = false;
    }
  }

  private async syncItemToCloud(userId: string, item: SyncQueueItem) {
    const { collection: collName, docId, action, payload } = item;
    const path = `users/${userId}/${collName}/${docId}`;
    const docRef = doc(db, 'users', userId, collName, docId);

    try {
      if (action === 'UPSERT') {
        await setDoc(docRef, { ...payload, syncedAt: new Date().toISOString() }, { merge: true });
      } else if (action === 'DELETE') {
        await deleteDoc(docRef);
      }
    } catch (error) {
      handleFirestoreError(error, action === 'UPSERT' ? OperationType.WRITE : OperationType.DELETE, path);
    }
  }

  async pullCloudState(userId: string): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    try {
      // 1. Profile
      const profRef = doc(db, 'users', userId, 'profile', 'data');
      const profSnap = await getDoc(profRef);
      if (profSnap.exists()) {
        await idb.saveProfile(profSnap.data() as any);
      }

      // 2. Positions
      const posColl = collection(db, 'users', userId, 'positions');
      const posSnap = await getDocs(posColl);
      posSnap.forEach(async (d) => {
        await idb.savePosition(d.data() as any);
      });

      // 3. Mistakes
      const mistColl = collection(db, 'users', userId, 'mistakes');
      const mistSnap = await getDocs(mistColl);
      mistSnap.forEach(async (d) => {
        await idb.saveMistake(d.data() as any);
      });

      // 4. Mastery
      const mastColl = collection(db, 'users', userId, 'mastery');
      const mastSnap = await getDocs(mastColl);
      mastSnap.forEach(async (d) => {
        await idb.saveMastery(d.data() as any);
      });

      this.updateState('SYNCED');
    } catch (err) {
      console.warn('Pull cloud state fallback to local-only:', err);
    }
  }
}

export const syncEngine = new SyncEngine();
