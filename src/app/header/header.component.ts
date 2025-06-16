import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  imports: [
    BrowserModule,
    ButtonModule,
    DropdownModule,
    FormsModule,
    TranslateModule
  ]
})
export class HeaderComponent {
  public selectedTheme = localStorage.getItem('theme-color') || 'green';
  themeOptions = [
    { label: 'Green', value: 'green' },
    { label: 'Red', value: 'red' },
    { label: 'Blue', value: 'blue' },
    { label: 'Yellow', value: 'yellow' }
  ];

  constructor(private translate: TranslateService) {
    translate.addLangs(['en', 'bg']);
    translate.setDefaultLang(localStorage.getItem('lang') || 'bg');
    const browserLang = translate.getBrowserLang();
    const langToUse = (browserLang && browserLang.match(/en|bg/)) ? browserLang : 'bg';
    translate.use(langToUse);
    localStorage.getItem('dark-mode') === 'enabled' && this.toggleDarkMode();
  }

  async onThemeChange(event: any) {
    localStorage.setItem('theme-color', event.value);
    window.location.reload();
  }

  toggleDarkMode() {
    const element = document.querySelector('html');
    element?.classList.toggle('my-app-dark');
    localStorage.setItem('dark-mode', element?.classList.contains('my-app-dark') ? 'enabled' : 'disabled');
  }
}
