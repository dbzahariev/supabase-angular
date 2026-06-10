import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

const ADMIN_STORAGE_KEY = 'admin_unlocked';

@Injectable({ providedIn: 'root' })
export class AdminService {

  /** Returns true if the admin key stored in localStorage matches the environment key. */
  isAdmin(): boolean {
    return localStorage.getItem(ADMIN_STORAGE_KEY) === environment.adminKey;
  }

  /**
   * Tries to unlock admin mode with the provided key.
   * Returns true on success, false on wrong key.
   */
  tryUnlock(key: string): boolean {
    if (key === environment.adminKey) {
      localStorage.setItem(ADMIN_STORAGE_KEY, key);
      return true;
    }
    return false;
  }

  lock(): void {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  }
}
