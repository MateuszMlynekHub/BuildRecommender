import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { routes } from './app.routes';

/**
 * Shared application config — used by BOTH the browser and the server
 * (prerender) bootstrap paths. Everything here must be SSR-safe: don't
 * put anything that touches `window` / `document` globals at construction
 * time. Browser-only providers like `provideBrowserGlobalErrorListeners`
 * live in `main.ts`, not here, so that `app.config.server.ts` can merge
 * this file without dragging a window-dependent listener onto the
 * server side (which otherwise crashes with NG0401 during
 * route extraction).
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    // withFetch() switches HttpClient from the legacy XHR backend to the
    // modern Fetch API, which is what @angular/ssr expects during
    // server-side prerendering (XHR doesn't exist on the server). It's
    // also faster in the browser thanks to HTTP/3 + streaming support.
    provideHttpClient(withFetch()),
    // provideClientHydration() re-uses the prerendered HTML as-is when
    // Angular bootstraps in the browser instead of throwing it away and
    // re-rendering everything from scratch. Without this you get a
    // flicker between the static HTML and the first CSR paint.
    provideClientHydration(),
  ],
};
