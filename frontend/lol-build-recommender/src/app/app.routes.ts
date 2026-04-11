import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';

export const routes: Routes = [
  // Home is eager — it's the landing route, prerendered to HTML, and every
  // first visit needs it immediately. No benefit to lazy-loading it.
  { path: '', component: HomeComponent },

  // /game is lazy-loaded. Rationale: this route only runs after a successful
  // Riot ID lookup on home, so it's NEVER the entry point for search traffic
  // or direct visitors. Eager-importing it was pulling GameViewComponent +
  // BuildPanelComponent + every active-game model into the initial bundle,
  // which Lighthouse flagged as ~1 MB of unused JS on the homepage.
  // Splitting it into its own chunk cuts the initial JS payload sharply
  // and improves Time-To-Interactive on the landing page.
  {
    path: 'game',
    loadComponent: () =>
      import('./features/game-view/game-view.component').then(
        (m) => m.GameViewComponent,
      ),
  },

  // Team Shuffle is lazy-loaded — the component + its ~10 kB of animation
  // styles + the champion fetch logic live in a separate JS chunk, fetched
  // on-demand when the user first navigates to /shuffle. Cost: a one-time
  // ~15 kB transfer the first time someone opens the shuffle page. Cached
  // afterward via standard browser caching on the hashed filename.
  {
    path: 'shuffle',
    loadComponent: () =>
      import('./features/team-shuffle/team-shuffle.component').then(
        (m) => m.TeamShuffleComponent,
      ),
  },

  { path: '**', redirectTo: '' },
];
