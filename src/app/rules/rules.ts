import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-rules',
  imports: [NgClass, TranslateModule],
  templateUrl: './rules.html',
  styleUrls: ['./rules.css'],
})
export class RulesComponent {
  private translate = inject(TranslateModule);

  readonly themeColors400: Record<string, string> = {
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
    red: 'text-red-400',
    pink: 'text-pink-400',
    purple: 'text-purple-400'
  };

  readonly themeColors600: Record<string, string> = {
    yellow: 'to-yellow-600',
    green: 'to-green-600',
    blue: 'to-blue-600',
    red: 'to-red-600',
    pink: 'to-pink-600',
    purple: 'to-purple-600'
  };

  get themeColor400() {
    const color = localStorage.getItem('theme-color') || 'yellow';
    return this.themeColors400[color] || 'text-yellow-400';
  }

  get themeColor600() {
    const color = localStorage.getItem('theme-color') || 'yellow';
    return this.themeColors600[color] || 'text-yellow-600';
  }

  readonly colorFromTs = '#25f11e';

  readonly animate = true;

  readonly iconColor = '#22c55e'; // or dynamic
}
