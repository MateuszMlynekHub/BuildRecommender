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

  // Team Shuffle is lazy-loaded.
  {
    path: 'shuffle',
    loadComponent: () =>
      import('./features/team-shuffle/team-shuffle.component').then(
        (m) => m.TeamShuffleComponent,
      ),
  },

  // Champions list — browse all champions with search + role filter.
  {
    path: 'champions',
    loadComponent: () =>
      import('./features/champions/champions-list.component').then(
        (m) => m.ChampionsListComponent,
      ),
  },

  // Per-champion detail page — builds, abilities, stats, lore.
  // :key is the DDragon champion key (e.g. "Aatrox", "MissFortune").
  {
    path: 'champion/:key',
    loadComponent: () =>
      import('./features/champions/champion-detail.component').then(
        (m) => m.ChampionDetailComponent,
      ),
  },

  { path: '**', redirectTo: '' },
];
