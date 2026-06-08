import { Component, OnInit } from '@angular/core'
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
  // session: typeof this.supabase.session

  constructor(
    private translateService: TranslateService) {
    // this.session = this.supabase.session
  }

  ngOnInit() {
    localStorage.getItem('dark-mode') === 'enabled' && App.prototype.toggleDarkMode.call(this);

    this.translateService.addLangs(['en', 'bg']);
    let browserLang = localStorage.getItem('lang') ?? this.translateService.getBrowserLang() ?? 'bg';
    this.translateService.setDefaultLang(browserLang);
    this.translateService.use(browserLang);
  }

  toggleDarkMode() {
    const element = document.querySelector('html');
    element?.classList.toggle('my-app-dark');
    localStorage.setItem('dark-mode', element?.classList.contains('my-app-dark') ? 'enabled' : 'disabled');
  }
}