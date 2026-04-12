import { bootstrapApplication } from '@angular/platform-browser';
import { provideBrowserGlobalErrorListeners, mergeApplicationConfig, isDevMode } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { appConfig } from './app/app.config';
import { App } from './app/app';

const browserConfig = mergeApplicationConfig(appConfig, {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
});

bootstrapApplication(App, browserConfig)
  .catch((err) => console.error(err));
