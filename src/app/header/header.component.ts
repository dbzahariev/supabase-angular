import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
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
import { AdminService } from '../services/admin.service';
import { UiPreferencesService } from '../services/ui-preferences.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { skip } from 'rxjs';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

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
    { route: 'group-standings', key: 'GROUP_STANDINGS', icon: 'pi pi-table' },
    { route: 'knockout-bracket', key: 'KNOCKOUT_BRACKET', icon: 'pi pi-sitemap' },
    { route: 'rules', key: 'ALL_RULES', icon: 'pi pi-paperclip' },
    { route: 'match-details', key: 'MATCH_DETAILS', icon: 'pi pi-info-circle', adminOnly: true },
    { route: 'live-monitor', key: 'LIVE_MONITOR', icon: 'pi pi-bolt', adminOnly: true },
    { route: 'live-monitor-full', key: 'LIVE_MONITOR_FULL', icon: 'pi pi-bolt', adminOnly: true }
  ];
  isDark = false;
  darkModeSetting: DarkModeSetting = 'disabled';
  currentRoute = '';
  canInstall = false;
  private installPrompt: BeforeInstallPromptEvent | null = null;
  private readonly IS_STANDALONE = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  colorOptions: ColorOption[] = [
    { en: 'Green', bg: 'Зелено', code: 'green' },
    { en: 'Red', bg: 'Червено', code: 'red' },
    { en: 'Blue', bg: 'Синьо', code: 'blue' },
    { en: 'Yellow', bg: 'Жълто', code: 'yellow' }
  ];
  themeColor!: string;
  themeTextColor = '#000000';
  themeColorNew = '#ffffff';
  showStatsCards = true;

  private translateService = inject(TranslateService);
  private router = inject(Router);
  private themeService = inject(ThemeService);
  private adminService = inject(AdminService);
  private uiPreferencesService = inject(UiPreferencesService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  get visibleTabs() {
    return this.tabs.filter(tab => !tab.adminOnly || this.adminService.isAdmin());
  }

  constructor() {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.currentRoute = event.urlAfterRedirects.slice(1);
      }
    });
  }

  ngOnInit() {
    this.themeService.initializeDarkMode();

    // Listen for PWA install prompt
    window.addEventListener('beforeinstallprompt', (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      this.deferInstallStateUpdate(() => {
        this.installPrompt = installEvent;
        this.canInstall = true;
      });
    });

    window.addEventListener('appinstalled', () => {
      this.deferInstallStateUpdate(() => {
        this.installPrompt = null;
        this.canInstall = false;
        localStorage.setItem('pwa-installed', 'true');
      });
    });

    const isLanguageNotSet = localStorage.getItem('lang') === null;
    if (isLanguageNotSet) {
      localStorage.setItem('lang', 'bg');
    }
    this.translateService.use(localStorage.getItem('lang') || 'bg');
    this.showStatsCards = this.uiPreferencesService.getShowStatsCards();
    this.themeColor = this.themeService.getThemeColor();
    this.darkModeSetting = this.themeService.getDarkModeSetting();
    this.isDark = this.themeService.isDarkModeActive();
    this.fixTextColor(this.isDark)

    const isThemeColorDefined = localStorage.getItem('theme-color') === null
    if (isThemeColorDefined) {
      this.onThemeColorChange(this.colorOptions[0].code);
    }

    this.themeService.darkModeSetting$
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((setting) => {
        this.darkModeSetting = setting;
      });

    this.themeService.darkModeActive$
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((isDarkModeActive) => {
        this.isDark = isDarkModeActive;
        this.fixTextColor(isDarkModeActive);
      });

    this.uiPreferencesService.showStatsCards$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((showStatsCards) => {
        this.showStatsCards = showStatsCards;
        this.cdr.markForCheck();
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

  get colorSelectOptions(): { label: string; value: string }[] {
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
  }

  onStatsVisibilityChange(show: boolean) {
    this.uiPreferencesService.setShowStatsCards(show);
  }

  installApp() {
    if (!this.installPrompt) return;

    this.installPrompt.prompt();
    this.installPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        this.deferInstallStateUpdate(() => {
          this.canInstall = false;
          this.installPrompt = null;
        });
      }
    });
  }

  private deferInstallStateUpdate(updateFn: () => void): void {
    this.ngZone.run(() => {
      setTimeout(() => {
        updateFn();
        this.cdr.markForCheck();
      }, 0);
    });
  }
}
