import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private themeColorSubject = new BehaviorSubject<string>(localStorage.getItem('theme-color') ?? 'green');
  themeColor$ = this.themeColorSubject.asObservable();

  setThemeColor(color: string) {
    localStorage.setItem('theme-color', color);
    this.themeColorSubject.next(color);
      window.location.reload(); 
  }

  getThemeColor(): string {
      return this.themeColorSubject.value;
  }
}
