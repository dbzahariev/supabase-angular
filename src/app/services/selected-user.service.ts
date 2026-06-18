import { Injectable } from '@angular/core';

const SELECTED_USER_ID_STORAGE_KEY = 'selected-user-id';
const LEGACY_SELECTED_USER_ID_STORAGE_KEY = 'selectedUserId';

@Injectable({ providedIn: 'root' })
export class SelectedUserService {
  getSelectedUserId(): number | null {
    const selectedUserId = localStorage.getItem(SELECTED_USER_ID_STORAGE_KEY);
    if (selectedUserId !== null) {
      const parsedSelectedUserId = Number(selectedUserId);
      return Number.isFinite(parsedSelectedUserId) ? parsedSelectedUserId : null;
    }

    const legacySelectedUserId = localStorage.getItem(LEGACY_SELECTED_USER_ID_STORAGE_KEY);
    if (legacySelectedUserId !== null) {
      localStorage.setItem(SELECTED_USER_ID_STORAGE_KEY, legacySelectedUserId);
      localStorage.removeItem(LEGACY_SELECTED_USER_ID_STORAGE_KEY);
    }

    const selectedUserIdToUse = legacySelectedUserId;
    if (selectedUserIdToUse === null) {
      return null;
    }

    const parsedSelectedUserId = Number(selectedUserIdToUse);
    return Number.isFinite(parsedSelectedUserId) ? parsedSelectedUserId : null;
  }

  setSelectedUserId(userId: number): void {
    localStorage.setItem(SELECTED_USER_ID_STORAGE_KEY, String(userId));
    localStorage.removeItem(LEGACY_SELECTED_USER_ID_STORAGE_KEY);
  }

  clearSelectedUserId(): void {
    localStorage.removeItem(SELECTED_USER_ID_STORAGE_KEY);
    localStorage.removeItem(LEGACY_SELECTED_USER_ID_STORAGE_KEY);
  }
}
