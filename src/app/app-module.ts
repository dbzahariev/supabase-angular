import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ButtonModule } from 'primeng/button';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Material from '@primeng/themes/material';
import Aura from '@primeng/themes/aura';
import Lara from '@primeng/themes/lara';
import Nora from '@primeng/themes/nora';

const themeMap: Record<string, any> = {
  material: Material,
  aura: Aura,
  lara: Lara,
  nora: Nora
};
const selectedTheme = localStorage.getItem('primeng-theme') || 'material';

import { App } from '../app/app';
import { AuthComponent } from './auth/auth';
import { AccountComponent } from './account/account';
import { AddPrediction } from "./add-prediction/add-prediction";
@NgModule({
  declarations: [App],
  imports: [BrowserModule, AuthComponent, AccountComponent, AddPrediction, ButtonModule],
  providers: [
    provideAnimationsAsync(),
    providePrimeNG({
      theme: { preset: themeMap[selectedTheme] }
    })
  ],
  bootstrap: [App],
})
export class AppModule { }
