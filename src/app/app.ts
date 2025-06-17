import { Component, OnInit, Inject } from '@angular/core'
import { SupabaseService } from '../app/supabase'
import { TranslateService } from '@ngx-translate/core'

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  providers: [SupabaseService]
})
export class App implements OnInit {
  session: typeof this.supabase.session

  constructor(
    @Inject(SupabaseService) private readonly supabase: SupabaseService,
    private translateService: TranslateService) {
    this.session = this.supabase.session
  }

  ngOnInit() {
    localStorage.getItem('dark-mode') === 'enabled' && App.prototype.toggleDarkMode.call(this);

    this.translateService.addLangs(['en', 'bg']);
    let browserLang = localStorage.getItem('lang') ?? this.translateService.getBrowserLang() ?? 'bg';
    this.translateService.setDefaultLang(browserLang);
    this.translateService.use(browserLang);

    this.supabase.authChanges((_, session) => (this.session = session))
  }

  toggleDarkMode() {
    const element = document.querySelector('html');
    element?.classList.toggle('my-app-dark');
    localStorage.setItem('dark-mode', element?.classList.contains('my-app-dark') ? 'enabled' : 'disabled');
  }
}