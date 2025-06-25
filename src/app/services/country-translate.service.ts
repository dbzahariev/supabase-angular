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

    translateCountryNameFromEnToBg(enName: string, lng: "bg" | "en"): string {
        const manualOverrides: Record<string, string> = {
            'Scotland': 'Шотландия',
            'England': 'Англия',
            'Wales': 'Уелс',
            'Northern Ireland': 'Северна Ирландия'
        };

        if (manualOverrides[enName]) {
            return manualOverrides[enName];
        }

        const entries = Object.entries(countries.getNames('en'));
        const found = entries.find(([_, name]) => name.toLowerCase() === enName.toLowerCase());
        if (!found) {
            return 'Непозната държава';
        }

        const code = found[0];
        return countries.getName(code, lng) || 'Непозната държава';
    }
}
