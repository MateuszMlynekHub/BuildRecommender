import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { appConfig } from './app.config';

/**
 * Providers added ONLY during server-side prerendering. Merged on top of
 * the shared `appConfig` so everything the browser uses (router, http
 * client, hydration) is still present during build-time rendering.
 *
 * `provideServerRendering()` installs the server-compatible DOM + event
 * shims that let Angular render templates without a real browser. It
 * replaces the DOCUMENT token with a synthetic jsdom-like wrapper — which
 * is why TranslationService and ConsentService already use
 * `document.defaultView?.localStorage` with try/catch: those optional
 * chains + fallback branches are what keeps them from crashing during
 * prerender when localStorage doesn't exist on the server.
 */
const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
