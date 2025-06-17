import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';

import { App } from '../app';

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
export class HeaderComponent implements OnInit {
  public selectedTheme = localStorage.getItem('theme-color') || 'green';

  labels: { label: { en: string, bg: string }, value: string }[] = [
    { label: { en: 'Green', bg: 'Зелено' }, value: 'green' },
    { label: { en: 'Red', bg: 'Червено' }, value: 'red' },
    { label: { en: 'Blue', bg: 'Синьо' }, value: 'blue' },
    { label: { en: 'Yellow', bg: 'Жълто' }, value: 'yellow' }
  ];
  realOptions: { label: string, value: string }[] = [];

  constructor(private translateService: TranslateService) { }

  ngOnInit() {
    this.fixLang();
  }

  fixLang() {
    const browserLang = localStorage.getItem('lang') ?? 'bg';
    if (browserLang === 'bg') {
      this.realOptions = this.labels.map(label => ({ label: label.label.bg, value: label.value }));
    }
    else if (browserLang === 'en') {
      this.realOptions = this.labels.map(label => ({ label: label.label.en, value: label.value }));
    }
  }

  public changeLanguage(lang: string) {
    this.translateService.use(lang);
    localStorage.setItem('lang', lang);

    this.fixLang();
  }

  toggleDarkMode() {
    App.prototype.toggleDarkMode.call(this);
  }

  public async onThemeChange(event: any) {
    localStorage.setItem('theme-color', event.value);
    window.location.reload();
  }
}
