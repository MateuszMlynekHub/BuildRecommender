import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { App } from './app/app';
import { config } from './app/app.config.server';

/**
 * Server-side bootstrap entry point used by the Angular build when it
 * prerenders routes at build time. Only called during `ng build` with
 * outputMode "static" — never at runtime. The Docker runtime image only
 * ships the resulting static HTML files; there is no Node server in prod.
 *
 * The default export is how @angular/build:application discovers the
 * bootstrap function to invoke per route it renders.
 *
 * Angular 21 change: `bootstrapApplication` accepts a third `context`
 * argument of type `BootstrapContext`, and on the server it's REQUIRED.
 * @angular/ssr's route extractor passes the context in, which gives the
 * platform reference a way to share state across the worker pool that
 * renders multiple routes in parallel. Omitting it throws NG0401
 * "Missing Platform" during route extraction.
 */
const bootstrap = (context: BootstrapContext) => bootstrapApplication(App, config, context);

export default bootstrap;
