import '@angular/compiler';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

async function cleanupStaleServiceWorkers(): Promise<void> {
  // Old service workers can serve stale index/bundle references after deploy.
  if (!(typeof window !== 'undefined' && 'serviceWorker' in navigator)) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  if (registrations.length === 0) {
    return;
  }

  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ('caches' in window) {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((key) => caches.delete(key)));
  }
}

void cleanupStaleServiceWorkers()
  .catch(() => {
    // Ignore cleanup errors and continue bootstrapping the app.
  })
  .finally(() => {
    platformBrowserDynamic().bootstrapModule(AppModule, {
      ngZoneEventCoalescing: true,
    })
      .catch(err => console.error(err));
  });
