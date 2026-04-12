import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes, RenderMode, ServerRoute } from '@angular/ssr';
import { appConfig } from './app.config';

/**
 * Server-side route configuration for Angular's static prerender.
 *
 * Parametric routes like `/champion/:key` can't be prerendered without
 * knowing every possible :key value upfront — marking them as
 * RenderMode.Client skips prerender and serves the CSR fallback HTML.
 * The SEO title/description are still set by SeoService in ngOnInit.
 *
 * The wildcard `**` at the bottom ensures all non-parametric routes
 * (/, /shuffle, /champions, /game) ARE prerendered to static HTML.
 */
const serverRoutes: ServerRoute[] = [
  { path: 'champion/:key', renderMode: RenderMode.Client },
  { path: 'guide/:slug', renderMode: RenderMode.Client },
  { path: 'summoner/:region/:name', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender },
];

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
