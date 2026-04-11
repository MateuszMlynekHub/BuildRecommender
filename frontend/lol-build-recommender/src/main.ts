import { bootstrapApplication } from '@angular/platform-browser';
import { provideBrowserGlobalErrorListeners, mergeApplicationConfig } from '@angular/core';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Browser-only providers layered on top of the shared appConfig. Keeping
// them here (not in app.config.ts) means `app.config.server.ts` can safely
// consume the shared config during prerender without inheriting listeners
// that need `window`. `provideBrowserGlobalErrorListeners` wires up
// `window.error` + `window.unhandledrejection` handlers — those globals
// don't exist in the synthetic DOM Angular uses for SSR/prerender.
const browserConfig = mergeApplicationConfig(appConfig, {
  providers: [provideBrowserGlobalErrorListeners()],
});

bootstrapApplication(App, browserConfig)
  .catch((err) => console.error(err));
