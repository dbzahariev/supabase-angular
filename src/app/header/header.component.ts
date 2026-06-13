import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { TabsModule } from 'primeng/tabs';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { ColorOption } from '../models/match.model';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  imports: [ButtonModule, FormsModule, TranslateModule, FloatLabelModule, TabsModule, RouterModule, CommonModule]
})
export class HeaderComponent implements OnInit {
  tabs = [
    { route: '', key: 'ALL_PREDICTIONS', icon: 'pi pi-chart-line' },
    { route: 'rules', key: 'ALL_RULES', icon: 'pi pi-paperclip' }
  ];
  isDark = localStorage.getItem('dark-mode') === 'enabled';
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

  constructor() {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.currentRoute = event.urlAfterRedirects.slice(1);
      }
    });
  }

  ngOnInit() {
    const isLnlang = localStorage.getItem('lang') === null;
    if (isLnlang) {
      localStorage.setItem('lang', 'bg');
    }
    this.translateService.use(localStorage.getItem('lang') || 'bg');
    this.themeColor = this.themeService.getThemeColor();
    this.fixTextColor()
    // this.themeColorNew = localStorage.getItem('theme-color') || '#ffffff';

    const isHaveThemeColor = localStorage.getItem('theme-color') === null
    if (isHaveThemeColor) {
      this.onThemeColorChange(this.colorOptions[0].code);
    }
  }

  getColorName(color: ColorOption): string {
    const lang = this.translateService.currentLang === 'bg' ? 'bg' : 'en';
    return color[lang];
  }

  changeLanguage(lang: string) {
    this.translateService.use(lang);
    localStorage.setItem('lang', lang);
  }

  toggleDarkMode() {
    const element = document.querySelector('html');
    element?.classList.toggle('my-app-dark');
    this.isDark = !this.isDark;
    localStorage.setItem('dark-mode', this.isDark ? 'enabled' : 'disabled');
    this.fixTextColor()
  }

  fixTextColor() {
    const isDark = localStorage.getItem('dark-mode') === 'enabled';
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
