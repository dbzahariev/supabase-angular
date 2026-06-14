import { Component, OnInit, inject } from '@angular/core'
import { SupabaseService } from '../app/supabase'
import { TranslateService } from '@ngx-translate/core'
import { ActivatedRoute } from '@angular/router'
import { NavigationEnd, Router } from '@angular/router'
import { filter } from 'rxjs'
import { AdminService } from './services/admin.service'

@Component({
  selector: 'app-root',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false,
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  providers: [SupabaseService],
})
export class App implements OnInit {
  private translateService = inject(TranslateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private adminService = inject(AdminService);

  constructor() { /* empty */ }

  ngOnInit() {
    const isDarkModeEnabled = localStorage.getItem('dark-mode') !== null;
    if (!isDarkModeEnabled) {
      localStorage.setItem('dark-mode', 'disabled')
    }

    if (localStorage.getItem('dark-mode') === 'enabled') {
      document.querySelector('html')?.classList.add('my-app-dark');
    }

    this.translateService.addLangs(['en', 'bg']);
    const browserLang = localStorage.getItem('lang') ?? this.translateService.getBrowserLang() ?? 'bg';
    this.translateService.setDefaultLang(browserLang);
    this.translateService.use(browserLang);

    this.updateScrollMode(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.updateScrollMode(event.urlAfterRedirects));

    // Unlock admin mode when navigating to /?set-admin=<key>
    this.route.queryParams.subscribe(params => {
      const key = params['set-admin'];
      if (key) {
        this.adminService.tryUnlock(key);
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

  toggleDarkMode() {
    const element = document.querySelector('html');
    element?.classList.toggle('my-app-dark');
    localStorage.setItem('dark-mode', element?.classList.contains('my-app-dark') ? 'enabled' : 'disabled');
  }
}