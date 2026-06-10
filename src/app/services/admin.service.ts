import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

const ADMIN_STORAGE_KEY = 'admin_unlocked';

@Injectable({ providedIn: 'root' })
export class AdminService {

  constructor() {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('set-admin');
    if (key) {
      this.tryUnlock(key);
    }
  }

  isAdmin(): boolean {
    return localStorage.getItem(ADMIN_STORAGE_KEY) === this.simpleHash(environment.adminKey);
  }

  tryUnlock(key: string): boolean {
    if (key === environment.adminKey) {
      localStorage.setItem(ADMIN_STORAGE_KEY, this.simpleHash(key));
      return true;
    }
    return false;
  }

  lock(): void {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  }

  private simpleHash(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
    }
    return hash.toString(16);
  }
}
