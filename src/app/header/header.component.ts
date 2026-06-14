import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { ColorOption } from '../models/match.model';
import { DarkModeSetting, ThemeService } from '../services/theme.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  imports: [ButtonModule, FormsModule, TranslateModule, FloatLabelModule, SelectModule, TabsModule, RouterModule, CommonModule]
})
export class HeaderComponent implements OnInit {
  protected readonly IS_SMALL_SCREEN = window.innerWidth < 768;
  tabs = [
    { route: '', key: 'ALL_PREDICTIONS', icon: 'pi pi-chart-line' },
    { route: 'rules', key: 'ALL_RULES', icon: 'pi pi-paperclip' }
  ];
  isDark = false;
  darkModeSetting: DarkModeSetting = 'disabled';
  currentRoute = '';
  colorOptions: ColorOption[] = [
    { en: 'Green', bg: 'Зелено', code: 'green' },
    { en: 'Red', bg: 'Червено', code: 'red' },
    { en: 'Blue', bg: 'Синьо', code: 'blue' },
    { en: 'Yellow', bg: 'Жълто', code: 'yellow' }
  ];
  themeColor!: string;
  themeTextColor = '#000000';
  themeColorNew = '#ffffff';

  private translateService = inject(TranslateService);
  private router = inject(Router);
  private themeService = inject(ThemeService);
  private destroyRef = inject(DestroyRef);

  constructor() {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.currentRoute = event.urlAfterRedirects.slice(1);
      }
    });
  }

  ngOnInit() {
    this.themeService.initializeDarkMode();

    const isLnlang = localStorage.getItem('lang') === null;
    if (isLnlang) {
      localStorage.setItem('lang', 'bg');
    }
    this.translateService.use(localStorage.getItem('lang') || 'bg');
    this.themeColor = this.themeService.getThemeColor();
    this.darkModeSetting = this.themeService.getDarkModeSetting();
    this.isDark = this.themeService.isDarkModeActive();
    this.fixTextColor(this.isDark)
    // this.themeColorNew = localStorage.getItem('theme-color') || '#ffffff';

    const isHaveThemeColor = localStorage.getItem('theme-color') === null
    if (isHaveThemeColor) {
      this.onThemeColorChange(this.colorOptions[0].code);
    }

    this.themeService.darkModeSetting$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((setting) => {
        this.darkModeSetting = setting;
      });

    this.themeService.darkModeActive$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((isDarkModeActive) => {
        this.isDark = isDarkModeActive;
        this.fixTextColor(isDarkModeActive);
      });
  }

  get darkModeIcon(): string {
    if (this.darkModeSetting === 'auto') {
      return this.IS_SMALL_SCREEN ? 'mobile' : 'desktop';
    }
    return this.isDark ? 'moon' : 'sun';
  }

  get darkModeAriaLabel(): string {
    if (this.darkModeSetting === 'auto') {
      return 'Color mode: auto (device)';
    }
    return this.isDark ? 'Color mode: dark' : 'Color mode: light';
  }

  getColorName(color: ColorOption): string {
    const lang = this.translateService.currentLang === 'bg' ? 'bg' : 'en';
    return color[lang];
  }

  get colorSelectOptions(): Array<{ label: string; value: string }> {
    return this.colorOptions.map((color) => ({
      label: this.getColorName(color),
      value: color.code,
    }));
  }

  changeLanguage(lang: string) {
    this.translateService.use(lang);
    localStorage.setItem('lang', lang);
  }

  toggleDarkMode() {
    this.themeService.cycleDarkModeSetting();
  }

  fixTextColor(isDark: boolean) {
    if (isDark) {
      this.themeTextColor = '#ffffff';
    } else {
      this.themeTextColor = '#000000';
    }
  }

  onThemeColorChange(code: string) {
    this.themeService.setThemeColor(code);
    this.themeColor = code;
    // Ако други компоненти са абонирани за themeColor$, ще се обновят автоматично
  }
}
