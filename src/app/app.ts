import { Component, OnInit, inject } from '@angular/core'
import { SupabaseService } from '../app/supabase'
import { TranslateService } from '@ngx-translate/core'
import { ActivatedRoute } from '@angular/router'
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
  private adminService = inject(AdminService);

  constructor() { /* empty */ }

  ngOnInit() {
    const isDarkModeEnabled = localStorage.getItem('dark-mode') !== null;
    if (!isDarkModeEnabled) {
      localStorage.setItem('dark-mode', 'disabled')
    }

    this.translateService.addLangs(['en', 'bg']);
    const browserLang = localStorage.getItem('lang') ?? this.translateService.getBrowserLang() ?? 'bg';
    this.translateService.setDefaultLang(browserLang);
    this.translateService.use(browserLang);

    // Unlock admin mode when navigating to /?set-admin=<key>
    this.route.queryParams.subscribe(params => {
      const key = params['set-admin'];
      if (key) {
        this.adminService.tryUnlock(key);
      }
    });
  }

  toggleDarkMode() {
    const element = document.querySelector('html');
    element?.classList.toggle('my-app-dark');
    localStorage.setItem('dark-mode', element?.classList.contains('my-app-dark') ? 'enabled' : 'disabled');
  }
}