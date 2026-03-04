import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { TabsModule } from 'primeng/tabs';
import { App } from '../app';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { ColorOption } from '../models/match.model';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  imports: [ButtonModule, FormsModule, TranslateModule, FloatLabelModule, TabsModule, RouterModule, CommonModule]
})
export class HeaderComponent implements OnInit {
  tabs = [
    { route: '', key: 'ALL_PREDICTIONS', icon: 'pi pi-chart-line' },
    { route: 'add-prediction', key: 'ADD_PREDICTION', icon: 'pi pi-plus-circle' },
    { route: 'chat', key: 'CHAT', icon: 'pi pi-home' },
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
    let lang = localStorage.getItem('lang');
    if (!lang) {
      lang = this.translateService.getBrowserLang() || 'en';
      localStorage.setItem('lang', lang);
    }
    this.translateService.use(lang);
    this.themeColor = this.themeService.getThemeColor();
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
    App.prototype.toggleDarkMode.call(this);
    this.isDark = !this.isDark;
    localStorage.setItem('dark-mode', this.isDark ? 'enabled' : 'disabled');
  }

  onThemeColorChange(code: string) {
    this.themeService.setThemeColor(code);
    this.themeColor = code;
    // Ако други компоненти са абонирани за themeColor$, ще се обновят автоматично
  }
}
