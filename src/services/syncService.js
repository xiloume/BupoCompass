import api from './api';

const SYNC_INTERVAL = 30000; // 30 seconds
const DEBOUNCE_DELAY = 2000; // 2 seconds after last change

class SyncService {
  constructor() {
    this.pendingChanges = [];
    this.lastSyncToken = localStorage.getItem('bupo_sync_token') || null;
    this.syncTimer = null;
    this.debounceTimer = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Load pending changes from localStorage (offline queue)
    const saved = localStorage.getItem('bupo_pending_changes');
    if (saved) {
      try {
        this.pendingChanges = JSON.parse(saved);
      } catch { /* ignore */ }
    }

    // Periodic sync
    this.syncTimer = setInterval(() => this.sync(), SYNC_INTERVAL);

    // Initial sync
    this.sync();
  }

  stop() {
    this.isRunning = false;
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.syncTimer = null;
    this.debounceTimer = null;
  }

  // Called when an item progress changes
  trackChange(itemId, current) {
    const change = {
      item_id: itemId,
      current,
      updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    // Replace existing change for same item
    const idx = this.pendingChanges.findIndex((c) => c.item_id === itemId);
    if (idx >= 0) {
      this.pendingChanges[idx] = change;
    } else {
      this.pendingChanges.push(change);
    }

    // Save to localStorage for offline resilience
    this.savePending();

    // Debounced sync
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.sync(), DEBOUNCE_DELAY);
  }

  async sync() {
    if (!api.isAuthenticated()) return;

    try {
      // Push local changes
      if (this.pendingChanges.length > 0) {
        await api.pushProgress(this.pendingChanges);
        this.pendingChanges = [];
        this.savePending();
      }

      // Pull remote changes
      const result = await api.pullProgress(this.lastSyncToken);

      if (result.changes && result.changes.length > 0) {
        // Apply remote changes to local store
        this.applyRemoteChanges(result.changes);
      }

      // Update sync token
      if (result.sync_token) {
        this.lastSyncToken = result.sync_token;
        localStorage.setItem('bupo_sync_token', result.sync_token);
      }
    } catch (err) {
      // Offline or error — changes stay in pending queue
      console.warn('[Sync] Failed:', err.message);
    }
  }

  applyRemoteChanges(changes) {
    // This will be connected to the store via a callback
    if (this.onRemoteChanges) {
      this.onRemoteChanges(changes);
    }
  }

  savePending() {
    localStorage.setItem('bupo_pending_changes', JSON.stringify(this.pendingChanges));
  }

  getPendingCount() {
    return this.pendingChanges.length;
  }
}

export const syncService = new SyncService();
export default syncService;
