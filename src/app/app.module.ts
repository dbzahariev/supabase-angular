import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Material from '@primeuix/themes/material';
import Aura from '@primeuix/themes/aura';
import Lara from '@primeuix/themes/lara';
import Nora from '@primeuix/themes/nora';
import { App } from './app';
import { definePreset } from '@primeuix/themes';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HeaderComponent } from './header/header.component';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AppRoutingModule } from './app-routing.module';
import { RulesComponent } from './rules/rules';

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

const themeMap: Record<string, object> = {
    material: Material,
    aura: Aura,
    lara: Lara,
    nora: Nora,
    myPreset: MyPreset
};
const selectedTheme = 'myPreset'

export function HttpLoaderFactory(http: HttpClient) {
    return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
    imports: [
        BrowserModule,
        RulesComponent,
        FormsModule,
        ButtonModule,
        HeaderComponent,
        ToastModule,
        TranslateModule.forRoot({
            loader: {
                provide: TranslateLoader,
                useFactory: HttpLoaderFactory,
                deps: [HttpClient],
            }
        }),
        AppRoutingModule,
    ],
    declarations: [App],
    bootstrap: [App],
    providers: [
        provideHttpClient(),
        provideAnimationsAsync(),
        providePrimeNG({
            theme: {
                preset: themeMap[selectedTheme],
                options: {
                    darkModeSelector: '.my-app-dark',
                }
            }
        }),
        MessageService
    ],
})
export class AppModule { }
