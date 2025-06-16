import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Material from '@primeng/themes/material';
import Aura from '@primeng/themes/aura';
import Lara from '@primeng/themes/lara';
import Nora from '@primeng/themes/nora';
import { App } from './app';
import { HeaderComponent } from './header/header.component';
import { AuthComponent } from './auth/auth';
import { AccountComponent } from './account/account';
import { AddPrediction } from "./add-prediction/add-prediction";
import { definePreset } from '@primeng/themes';
import { DropdownModule } from 'primeng/dropdown';
import { TranslateModule } from '@ngx-translate/core';

const mainColor = localStorage.getItem('theme-color') || 'green'

const MyPreset = definePreset(Aura, {
    semantic: {
        primary: {
            50: `{${mainColor}.50}`,
            100: `{${mainColor}.100}`,
            200: `{${mainColor}.200}`,
            300: `{${mainColor}.300}`,
            400: `{${mainColor}.400}`,
            500: `{${mainColor}.500}`,
            600: `{${mainColor}.600}`,
            700: `{${mainColor}.700}`,
            800: `{${mainColor}.800}`,
            900: `{${mainColor}.900}`,
            950: `{${mainColor}.950}`
        }
    }
});

const themeMap: Record<string, any> = {
    material: Material,
    aura: Aura,
    lara: Lara,
    nora: Nora,
    myPreset: MyPreset
};
const selectedTheme = 'myPreset'// localStorage.getItem('primeng-theme') || 'material';

@NgModule({
    declarations: [
        App,
    ],
    imports: [
        HeaderComponent,
        BrowserModule,
        FormsModule,
        AuthComponent,
        AccountComponent,
        AddPrediction,
        ButtonModule,
        DropdownModule,
        TranslateModule.forRoot(),
    ],
    bootstrap: [App],
    providers: [
        provideAnimationsAsync(),
        providePrimeNG({
            theme: {
                preset: themeMap[selectedTheme],
                options: {
                    darkModeSelector: '.my-app-dark',
                }
            }
        })
    ],
})
export class AppModule { }
