import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { FloatLabelModule } from 'primeng/floatlabel';

import { App } from '../app';
import { SelectModule } from 'primeng/select';

type Color = {
  name: string;
  code: string;
};

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  imports: [ButtonModule, DropdownModule, SelectModule, FormsModule, TranslateModule, FloatLabelModule]
})
export class HeaderComponent implements OnInit {
  isDark = localStorage.getItem('dark-mode') === 'enabled';
  currentColor = signal<Color>({ name: '', code: '' });

  realOptionsColors: Color[] = [];

  constructor(private translateService: TranslateService) { }

  ngOnInit() {
    this.fixLang();
  }

  fixLang() {
    const colorOptions: { label: { en: string, bg: string }, code: string }[] = [
      { label: { en: 'Green', bg: 'Зелено' }, code: 'green' },
      { label: { en: 'Red', bg: 'Червено' }, code: 'red' },
      { label: { en: 'Blue', bg: 'Синьо' }, code: 'blue' },
      { label: { en: 'Yellow', bg: 'Жълто' }, code: 'yellow' }
    ];

    const browserLang = localStorage.getItem('lang') ?? 'bg';
    if (browserLang === 'bg') {
      this.realOptionsColors = colorOptions.map(label => ({ name: label.label.bg, code: label.code }));
    }
    else if (browserLang === 'en') {
      this.realOptionsColors = colorOptions.map(label => ({ name: label.label.en, code: label.code }));
    }
    let previousThemeColorCode = localStorage.getItem('theme-color') ?? this.realOptionsColors[0].code;
    this.currentColor.set(this.realOptionsColors.find(color => color.code === previousThemeColorCode) ?? this.realOptionsColors[0]);
  }

  public changeLanguage(lang: string) {
    this.translateService.use(lang);
    localStorage.setItem('lang', lang);

    this.fixLang();
  }

  toggleDarkMode() {
    App.prototype.toggleDarkMode.call(this);
    this.isDark = !this.isDark;
  }

  public async setThemeColor(event: any) {
    this.currentColor.set(event);
    localStorage.setItem('theme-color', event.code);
    window.location.reload();
  }
}
