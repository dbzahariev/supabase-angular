import { Injectable } from '@angular/core';
import countries from 'i18n-iso-countries';
import * as enLocale from 'i18n-iso-countries/langs/en.json';
import * as bgLocale from 'i18n-iso-countries/langs/bg.json';

@Injectable({
    providedIn: 'root'
})
export class CountryTranslateService {
    constructor() {
        countries.registerLocale(enLocale);
        countries.registerLocale(bgLocale);
    }

    translateCountryNameFromEnToLng(enName: string, lng: "bg" | "en"): string {
        const manualOverrides: Record<string, string> = {
            'Scotland': 'Шотландия',
            'England': 'Англия',
            'Wales': 'Уелс',
            'Northern Ireland': 'Северна Ирландия',
        };

        if (manualOverrides[enName]) {
            return lng === 'bg' ? manualOverrides[enName] : enName;
        }
        const alpha2Code = countries.getAlpha2Code(enName, 'en') ?? "";
        if (alpha2Code === '') {
            return 'Непозната държава';
        }

        return countries.getName(alpha2Code, lng) || 'Непозната държава';
    }
}
