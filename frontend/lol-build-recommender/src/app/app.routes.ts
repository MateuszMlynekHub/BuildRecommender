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
  {
    path: 'champion/:key',
    loadComponent: () =>
      import('./features/champions/champion-detail.component').then(
        (m) => m.ChampionDetailComponent,
      ),
  },

  // Draft Advisor — champion select simulator with counter-pick suggestions.
  {
    path: 'draft',
    loadComponent: () =>
      import('./features/draft/draft-advisor.component').then(
        (m) => m.DraftAdvisorComponent,
      ),
  },

  // Tier list — champion rankings by win rate per role.
  {
    path: 'tier-list',
    loadComponent: () =>
      import('./features/tier-list/tier-list.component').then(
        (m) => m.TierListComponent,
      ),
  },

  // Summoner search page.
  {
    path: 'summoner',
    loadComponent: () =>
      import('./features/summoner/summoner-search.component').then(
        (m) => m.SummonerSearchComponent,
      ),
  },

  // Summoner profile — player lookup with match history.
  {
    path: 'summoner/:region/:name',
    loadComponent: () =>
      import('./features/summoner/summoner-profile.component').then(
        (m) => m.SummonerProfileComponent,
      ),
  },

  // Summoner mastery — full champion mastery list.
  {
    path: 'summoner/:region/:name/mastery',
    loadComponent: () =>
      import('./features/summoner/summoner-mastery.component').then(
        (m) => m.SummonerMasteryComponent,
      ),
  },

  // Guides — static SEO content pages.
  {
    path: 'guide',
    loadComponent: () =>
      import('./features/guides/guide.component').then(m => m.GuideComponent),
  },
  {
    path: 'guide/:slug',
    loadComponent: () =>
      import('./features/guides/guide.component').then(m => m.GuideComponent),
  },

  // Meta Shift — patch win rate change tracker.
  {
    path: 'meta',
    loadComponent: () =>
      import('./features/meta-shift/meta-shift.component').then(
        (m) => m.MetaShiftComponent,
      ),
  },

  // Multi-search — lobby scanner for pre-game analysis.
  {
    path: 'multisearch',
    loadComponent: () =>
      import('./features/multisearch/multisearch.component').then(
        (m) => m.MultisearchComponent,
      ),
  },

  // Leaderboards — competitive rankings.
  {
    path: 'leaderboard',
    loadComponent: () =>
      import('./features/leaderboard/leaderboard.component').then(
        (m) => m.LeaderboardComponent,
      ),
  },

  // Build Simulator — what-if build analysis.
  {
    path: 'simulator',
    loadComponent: () =>
      import('./features/simulator/build-simulator.component').then(
        (m) => m.BuildSimulatorComponent,
      ),
  },

  // Roast My Build — build report card.
  {
    path: 'roast',
    loadComponent: () =>
      import('./features/roast/roast-build.component').then(
        (m) => m.RoastBuildComponent,
      ),
  },

  // Best Builder — leaderboard of top build scorers.
  {
    path: 'best-builders',
    loadComponent: () =>
      import('./features/roast/build-leaderboard.component').then(
        (m) => m.BuildLeaderboardComponent,
      ),
  },

  // Team Report — batch analyze multiple players' builds.
  {
    path: 'roast/team',
    loadComponent: () =>
      import('./features/roast/team-report.component').then(
        (m) => m.TeamReportComponent,
      ),
  },

  // Build Battle — item picking challenge.
  {
    path: 'build-battle',
    loadComponent: () =>
      import('./features/build-battle/build-battle.component').then(
        (m) => m.BuildBattleComponent,
      ),
  },

  // Season Wrapped — player season summary.
  {
    path: 'wrapped',
    loadComponent: () =>
      import('./features/roast/season-wrapped.component').then(
        (m) => m.SeasonWrappedComponent,
      ),
  },

  // Gold Advisor — gold-efficient item recommendations.
  {
    path: 'gold-advisor',
    loadComponent: () =>
      import('./features/gold-advisor/gold-advisor.component').then(
        (m) => m.GoldAdvisorComponent,
      ),
  },

  // Mode Tier List — ARAM, Arena & Ranked tier lists.
  {
    path: 'mode-tierlist',
    loadComponent: () =>
      import('./features/mode-tierlist/mode-tierlist.component').then(
        (m) => m.ModeTierListComponent,
      ),
  },

  // Duo Synergy — best champion pairs by win rate.
  {
    path: 'duo-synergy',
    loadComponent: () =>
      import('./features/duo-synergy/duo-synergy.component').then(
        (m) => m.DuoSynergyComponent,
      ),
  },

  // Pro Builds — recent high-elo / Challenger builds.
  {
    path: 'pro-builds',
    loadComponent: () =>
      import('./features/pro-builds/pro-builds.component').then(
        (m) => m.ProBuildsComponent,
      ),
  },

  { path: '**', redirectTo: '' },
];
