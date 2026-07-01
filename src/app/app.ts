import { Component, OnInit, inject } from '@angular/core'
import { SupabaseService } from '../app/supabase'
import { TranslateService } from '@ngx-translate/core'
import { ActivatedRoute } from '@angular/router'
import { NavigationEnd, Router } from '@angular/router'
import { filter } from 'rxjs'
import { AdminService } from './services/admin.service'
import { ThemeService } from './services/theme.service'

@Component({
  selector: 'app-root',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false,
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  providers: [SupabaseService],
})
export class App implements OnInit {
  private readonly predictionMonitorStorageKey = 'prediction_points_monitor';
  private translateService = inject(TranslateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private adminService = inject(AdminService);
  private themeService = inject(ThemeService);

  constructor() { /* empty */ }

  ngOnInit() {
    this.themeService.initializeDarkMode();

    this.translateService.addLangs(['en', 'bg']);
    const browserLang = localStorage.getItem('lang') ?? this.translateService.getBrowserLang() ?? 'bg';
    this.translateService.setDefaultLang(browserLang);
    this.translateService.use(browserLang);

    this.updateScrollMode(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.updateScrollMode(event.urlAfterRedirects));

    // Toggle admin mode with query params:
    // /?set-admin=<key> to unlock, /?remove-admin to lock.
    // Toggle prediction monitor with query params:
    // /?set-monitor=1 (or true/on/debug) to enable, /?remove-monitor to disable.
    this.route.queryParams.subscribe(params => {
      let shouldCleanQueryParams = false;

      if (params['remove-admin'] !== undefined) {
        this.adminService.lock();
        shouldCleanQueryParams = true;
      }

      if (params['remove-monitor'] !== undefined) {
        localStorage.removeItem(this.predictionMonitorStorageKey);
        shouldCleanQueryParams = true;
      }

      const key = params['set-admin'];
      if (key) {
        this.adminService.tryUnlock(key);
        shouldCleanQueryParams = true;
      }

      const monitorValue = params['set-monitor'];
      if (monitorValue !== undefined) {
        const normalized = String(monitorValue).trim().toLowerCase();
        const shouldEnable = normalized.length === 0 || ['1', 'true', 'on', 'yes', 'debug'].includes(normalized);

        if (shouldEnable) {
          localStorage.setItem(this.predictionMonitorStorageKey, '1');
        }

        shouldCleanQueryParams = true;
      }

      if (shouldCleanQueryParams) {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {
            ...params,
            'set-admin': null,
            'remove-admin': null,
            'set-monitor': null,
            'remove-monitor': null,
          },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    });
  }

  private updateScrollMode(url: string): void {
    const pathname = url.split('?')[0];
    const isRulesRoute = pathname === '/rules';
    const html = document.documentElement;
    const body = document.body;

    html.classList.toggle('rules-scroll-enabled', isRulesRoute);
    body.classList.toggle('rules-scroll-enabled', isRulesRoute);
  }
}