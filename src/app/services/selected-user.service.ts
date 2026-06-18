import { Injectable } from '@angular/core';

const SELECTED_USER_ID_STORAGE_KEY = 'selectedUserId';

@Injectable({ providedIn: 'root' })
export class SelectedUserService {
  getSelectedUserId(): number | null {
    const selectedUserId = localStorage.getItem(SELECTED_USER_ID_STORAGE_KEY);
    if (selectedUserId === null) {
      return null;
    }

    const parsedSelectedUserId = Number(selectedUserId);
    return Number.isFinite(parsedSelectedUserId) ? parsedSelectedUserId : null;
  }

  setSelectedUserId(userId: number): void {
    localStorage.setItem(SELECTED_USER_ID_STORAGE_KEY, String(userId));
  }

  clearSelectedUserId(): void {
    localStorage.removeItem(SELECTED_USER_ID_STORAGE_KEY);
  }
}
