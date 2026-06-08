import { Component, OnInit, inject } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { SupabaseService } from '../app/supabase'
import { TranslateService } from '@ngx-translate/core'
import { ToastModule } from 'primeng/toast'
import { HeaderComponent } from './header/header.component'

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, ToastModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  providers: [SupabaseService],
})
export class App implements OnInit {
  private translateService = inject(TranslateService);

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
  }

  toggleDarkMode() {
    const element = document.querySelector('html');
    element?.classList.toggle('my-app-dark');
    localStorage.setItem('dark-mode', element?.classList.contains('my-app-dark') ? 'enabled' : 'disabled');
  }
}