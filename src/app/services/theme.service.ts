import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { combineLatest, distinctUntilChanged, map } from 'rxjs';

export type DarkModeSetting = 'disabled' | 'enabled' | 'auto';

const DARK_MODE_STORAGE_KEY = 'dark-mode';
const SYSTEM_DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private themeColorSubject = new BehaviorSubject<string>(localStorage.getItem('theme-color') ?? 'green');
  private darkModeSettingSubject = new BehaviorSubject<DarkModeSetting>(this.readDarkModeSetting());
  private systemDarkPreferredSubject = new BehaviorSubject<boolean>(this.readSystemDarkPreferred());
  private initialized = false;

  themeColor$ = this.themeColorSubject.asObservable();
  darkModeSetting$ = this.darkModeSettingSubject.asObservable();
  darkModeActive$ = combineLatest([this.darkModeSetting$, this.systemDarkPreferredSubject.asObservable()]).pipe(
    map(([setting, systemDark]) => setting === 'enabled' || (setting === 'auto' && systemDark)),
    distinctUntilChanged(),
  );

  initializeDarkMode() {
    if (this.initialized) {
      this.applyDarkModeClass(this.isDarkModeActive());
      return;
    }

    this.initialized = true;
    this.applyDarkModeClass(this.isDarkModeActive());

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const media = window.matchMedia(SYSTEM_DARK_MEDIA_QUERY);
      const listener = (event: MediaQueryListEvent) => {
        this.systemDarkPreferredSubject.next(event.matches);
        if (this.darkModeSettingSubject.value === 'auto') {
          this.applyDarkModeClass(event.matches);
        }
      };

      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', listener);
      } else if (typeof media.addListener === 'function') {
        media.addListener(listener);
      }
    }
  }

  setThemeColor(color: string) {
    localStorage.setItem('theme-color', color);
    this.themeColorSubject.next(color);
  }

  getThemeColor(): string {
    return this.themeColorSubject.value;
  }

  getDarkModeSetting(): DarkModeSetting {
    return this.darkModeSettingSubject.value;
  }

  setDarkModeSetting(setting: DarkModeSetting) {
    localStorage.setItem(DARK_MODE_STORAGE_KEY, setting);
    this.darkModeSettingSubject.next(setting);
    this.applyDarkModeClass(this.isDarkModeActive());
  }

  cycleDarkModeSetting(): DarkModeSetting {
    const current = this.darkModeSettingSubject.value;
    const next: DarkModeSetting = current === 'disabled' ? 'enabled' : current === 'enabled' ? 'auto' : 'disabled';
    this.setDarkModeSetting(next);
    return next;
  }

  isDarkModeActive(): boolean {
    const setting = this.darkModeSettingSubject.value;
    return setting === 'enabled' || (setting === 'auto' && this.systemDarkPreferredSubject.value);
  }

  private readDarkModeSetting(): DarkModeSetting {
    const value = localStorage.getItem(DARK_MODE_STORAGE_KEY);
    if (value === 'enabled' || value === 'disabled' || value === 'auto') {
      return value;
    }

    localStorage.setItem(DARK_MODE_STORAGE_KEY, 'auto');
    return 'auto';
  }

  private readSystemDarkPreferred(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia(SYSTEM_DARK_MEDIA_QUERY).matches;
  }

  private applyDarkModeClass(enabled: boolean) {
    const html = document.documentElement;
    html.classList.toggle('my-app-dark', enabled);
  }
}
