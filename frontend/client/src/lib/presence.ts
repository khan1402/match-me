// Presence tracking: maintains online/offline status for users
// This is a global singleton that can be shared across components

type PresenceMap = Map<number, boolean>; // userId -> online

class PresenceManager {
  private presence: PresenceMap = new Map();
  private listeners: Set<(presence: PresenceMap) => void> = new Set();

  // Update presence for a user
  update(userId: number, online: boolean) {
    // Normalize userId to number to ensure consistent key type
    const normalizedId = Number(userId);
    if (isNaN(normalizedId)) {
      console.error("[PresenceManager] Invalid userId:", userId);
      return;
    }
    this.presence.set(normalizedId, online);
    this.notifyListeners();
  }

  // Get online status for a user (defaults to false if unknown)
  isOnline(userId: number): boolean {
    const normalizedId = Number(userId);
    return this.presence.get(normalizedId) || false;
  }

  // Subscribe to presence updates
  subscribe(listener: (presence: PresenceMap) => void) {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(new Map(this.presence));
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const currentPresence = new Map(this.presence);
    this.listeners.forEach((listener) => {
      try {
        listener(currentPresence);
      } catch (err) {
        console.error("[PresenceManager] Error in listener:", err);
      }
    });
  }

  // Get all presence data
  getAll(): PresenceMap {
    return new Map(this.presence);
  }

  // Clear all presence (useful when WebSocket disconnects)
  clear() {
    this.presence.clear();
    this.notifyListeners();
  }

  // Mark all users as offline (useful when WebSocket disconnects)
  markAllOffline() {
    for (const userId of this.presence.keys()) {
      this.presence.set(userId, false);
    }
    this.notifyListeners();
  }
}

// Export singleton instance
export const presenceManager = new PresenceManager();

