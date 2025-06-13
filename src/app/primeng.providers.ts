import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

export const PRIME_NG_PROVIDERS = [
  provideAnimationsAsync(),
  providePrimeNG({
    theme: {
      preset: Aura
    }
  })
];
