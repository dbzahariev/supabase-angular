import { Component, OnInit, Inject } from '@angular/core'
import { SupabaseService } from '../app/supabase'
import { TranslateService } from '@ngx-translate/core'
import { ToastModule } from 'primeng/toast'
import { HeaderComponent } from "./header/header.component";
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  providers: [SupabaseService],
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

    this.loadTranslations();
  }

  toggleDarkMode() {
    const element = document.querySelector('html');
    element?.classList.toggle('my-app-dark');
    localStorage.setItem('dark-mode', element?.classList.contains('my-app-dark') ? 'enabled' : 'disabled');


  }

  loadTranslations() {
    setTimeout(() => {
      let foo = this.translateService.instant("TABLE.HOME_TEAM");
      console.log("New translation:", foo);
    }, 1);
  }
}