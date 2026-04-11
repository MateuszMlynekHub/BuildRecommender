import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { GameViewComponent } from './features/game-view/game-view.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'game', component: GameViewComponent },
  {
    // Team Shuffle is lazy-loaded — the component + its ~10 kB of animation
    // styles + the champion fetch logic live in a separate JS chunk, fetched
    // on-demand when the user first navigates to /shuffle. This keeps the
    // initial bundle under the 500 kB budget (otherwise the shuffle feature
    // pushes us ~4 kB over). Cost: a one-time ~15 kB transfer the first time
    // someone opens the shuffle page. Cached afterward via service worker
    // style browser caching on the hashed filename.
    path: 'shuffle',
    loadComponent: () =>
      import('./features/team-shuffle/team-shuffle.component').then(
        (m) => m.TeamShuffleComponent,
      ),
  },
  { path: '**', redirectTo: '' },
];
