import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { GameStateService } from '../../core/services/game-state.service';
import { SeoService } from '../../core/services/seo.service';
import { Champion } from '../../core/models/champion.model';
import {
  DDragonChampionDetail, ChampionBuildStat, RunePage, IndividualRuneStat,
  SpellSet, MatchupStat, BuildOrderEntry, SkillOrderEntry, StartingItemEntry,
  PatchTrend, CounterTip,
} from '../../core/models/champion-detail.model';
import { TPipe } from '../../shared/pipes/t.pipe';
import { PERK_ICONS } from '../../core/perk-icons';

const SPELL_KEYS = ['Q', 'W', 'E', 'R'] as const;

/** Summoner spell ID → name mapping (Riot static data). */
const SUMMONER_SPELLS: Record<number, { name: string; img: string }> = {
  1:  { name: 'Cleanse',    img: 'SummonerBoost.png' },
  3:  { name: 'Exhaust',    img: 'SummonerExhaust.png' },
  4:  { name: 'Flash',      img: 'SummonerFlash.png' },
  6:  { name: 'Ghost',      img: 'SummonerHaste.png' },
  7:  { name: 'Heal',       img: 'SummonerHeal.png' },
  11: { name: 'Smite',      img: 'SummonerSmite.png' },
  12: { name: 'Teleport',   img: 'SummonerTeleport.png' },
  14: { name: 'Ignite',     img: 'SummonerDot.png' },
  21: { name: 'Barrier',    img: 'SummonerBarrier.png' },
  32: { name: 'Snowball',   img: 'SummonerSnowball.png' },
};

/** Rune tree ID → name + color. */
const RUNE_TREES: Record<number, { name: string; color: string }> = {
  8000: { name: 'Precision',   color: '#C8AA6E' },
  8100: { name: 'Domination',  color: '#D44242' },
  8200: { name: 'Sorcery',     color: '#9B6FE3' },
  8300: { name: 'Inspiration', color: '#49AAD1' },
  8400: { name: 'Resolve',     color: '#A8D26A' },
};

@Component({
  selector: 'app-champion-detail',
  standalone: true,
  imports: [RouterLink, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cd-page">
      @if (detail()) {
        @let d = detail()!;
        @let v = version();

        <!-- Hero -->
        <div class="cd-hero">
          <a routerLink="/champions" class="cd-hero__back">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            {{ 'champions.title' | t }}
          </a>

          <div class="cd-hero__main">
            <img class="cd-hero__portrait"
              [src]="'https://ddragon.leagueoflegends.com/cdn/' + v + '/img/champion/' + championInfo()?.imageFileName"
              [alt]="d.name" width="90" height="90" />
            <div class="cd-hero__info">
              <h1 class="cd-hero__name">{{ d.name }}</h1>
              <div class="cd-hero__title">{{ d.title }}</div>
              <div class="cd-hero__tags">
                @for (tag of d.tags; track tag) { <span class="cd-hero__tag">{{ tag }}</span> }
                @for (pos of championInfo()?.positions ?? []; track pos) { <span class="cd-hero__pos">{{ pos }}</span> }
              </div>
            </div>
          </div>
        </div>

        <!-- Role tabs -->
        @if ((championInfo()?.positions?.length ?? 0) > 1) {
          <div class="cd-role-tabs">
            @for (pos of championInfo()!.positions; track pos) {
              <button
                type="button"
                class="cd-role-tab"
                [class.cd-role-tab--active]="selectedRole() === pos"
                (click)="switchRole(pos)"
              >{{ pos }}</button>
            }
          </div>
        }

        <!-- Two-column layout -->
        <div class="cd-grid">
          <!-- LEFT COLUMN -->
          <div class="cd-col">

            <!-- Runes -->
              <section class="cd-section">
                <h2 class="cd-section__title">Runes</h2>
            @if (runes().length > 0) {
                @for (rp of runes(); track $index; let first = $first) {
                  <div class="cd-rune" [class.cd-rune--primary]="first">
                    <div class="cd-rune__header">
                      <div class="cd-rune__trees">
                        <span class="cd-rune__tree" [style.color]="runeTreeColor(rp.primaryStyle)">{{ runeTreeName(rp.primaryStyle) }}</span>
                        <span class="cd-rune__sep">/</span>
                        <span class="cd-rune__tree" [style.color]="runeTreeColor(rp.subStyle)">{{ runeTreeName(rp.subStyle) }}</span>
                      </div>
                      <div class="cd-rune__meta">
                        <span class="cd-rune__wr">{{ (rp.winRate * 100).toFixed(1) }}% WR</span>
                        <span class="cd-rune__pr">{{ rp.picks }} games</span>
                      </div>
                    </div>
                    <div class="cd-rune__perks">
                      @for (perkId of rp.perks; track $index; let i = $index) {
                        <img class="cd-rune__perk-img"
                          [src]="perkIconUrl(perkId)"
                          [alt]="'Perk ' + perkId"
                          width="28" height="28"
                          loading="lazy"
                          (error)="onPerkImgError($event)"
                          [class.cd-rune__perk-img--keystone]="i === 0"
                        />
                      }
                    </div>
                  </div>
                }
            } @else {
                <div class="cd-empty">Collecting rune data from Challenger matches...</div>
            }
              </section>

            <!-- Individual Rune Table -->
              <section class="cd-section">
                <h2 class="cd-section__title">{{ 'champion.detail.runeTable' | t }}</h2>
            @if (individualRunes().length > 0) {
                <div class="cd-rune-table">
                  @for (slot of [0,1,2,3,4,5]; track slot) {
                    <div class="cd-rune-table__slot">
                      <div class="cd-rune-table__slot-label">
                        {{ slot === 0 ? 'Keystone' : 'Slot ' + slot }}
                      </div>
                      @for (rs of individualRunesBySlot(slot); track rs.perkId) {
                        <div class="cd-rune-table__row">
                          <img class="cd-rune-table__icon"
                            [src]="perkIconUrl(rs.perkId)"
                            width="24" height="24"
                            loading="lazy"
                            (error)="onPerkImgError($event)" />
                          <div class="cd-rune-table__bar"
                            [style.width.%]="rs.pickRate * 100">
                          </div>
                          <span class="cd-rune-table__wr">{{ (rs.winRate * 100).toFixed(1) }}%</span>
                          <span class="cd-rune-table__pr">{{ (rs.pickRate * 100).toFixed(0) }}%</span>
                        </div>
                      }
                    </div>
                  }
                </div>
            } @else {
                <div class="cd-empty">{{ 'champion.detail.noRuneTable' | t }}</div>
            }
              </section>

            <!-- Summoner Spells -->
              <section class="cd-section">
                <h2 class="cd-section__title">Summoner Spells</h2>
            @if (spells().length > 0) {
                @for (sp of spells(); track $index) {
                  <div class="cd-spell-row">
                    <div class="cd-spell-row__icons">
                      <img class="cd-spell-row__img"
                        [src]="spellImgUrl(sp.spell1Id)"
                        [alt]="spellName(sp.spell1Id)"
                        width="32" height="32" />
                      <img class="cd-spell-row__img"
                        [src]="spellImgUrl(sp.spell2Id)"
                        [alt]="spellName(sp.spell2Id)"
                        width="32" height="32" />
                    </div>
                    <div class="cd-spell-row__names">{{ spellName(sp.spell1Id) }} + {{ spellName(sp.spell2Id) }}</div>
                    <div class="cd-spell-row__stats">
                      <span class="cd-spell-row__wr">{{ (sp.winRate * 100).toFixed(1) }}%</span>
                      <span class="cd-spell-row__picks">{{ sp.picks }} games</span>
                    </div>
                  </div>
                }
            } @else {
                <div class="cd-empty">Collecting summoner spell data...</div>
            }
              </section>

            <!-- Abilities -->
            <section class="cd-section">
              <h2 class="cd-section__title">{{ 'champion.abilities' | t }}</h2>
              <div class="cd-abilities">
                <div class="cd-ability">
                  <div class="cd-ability__header">
                    <img class="cd-ability__icon"
                      [src]="'https://ddragon.leagueoflegends.com/cdn/' + v + '/img/passive/' + d.passive.image.full"
                      [alt]="d.passive.name" width="36" height="36" />
                    <div class="cd-ability__key cd-ability__key--passive">P</div>
                    <div class="cd-ability__name">{{ d.passive.name }}</div>
                  </div>
                  <div class="cd-ability__desc" [innerHTML]="d.passive.description"></div>
                </div>
                @for (spell of d.spells; track spell.id; let i = $index) {
                  <div class="cd-ability">
                    <div class="cd-ability__header">
                      <img class="cd-ability__icon"
                        [src]="'https://ddragon.leagueoflegends.com/cdn/' + v + '/img/spell/' + spell.image.full"
                        [alt]="spell.name" width="36" height="36" />
                      <div class="cd-ability__key">{{ spellKeys[i] }}</div>
                      <div class="cd-ability__name">{{ spell.name }}</div>
                    </div>
                    <div class="cd-ability__meta">
                      @if (spell.cooldownBurn && spell.cooldownBurn !== '0') {
                        <span>CD: {{ spell.cooldownBurn }}s</span>
                      }
                      @if (spell.costBurn && spell.costBurn !== '0') {
                        <span>Cost: {{ spell.costBurn }}</span>
                      }
                    </div>
                    <div class="cd-ability__desc" [innerHTML]="spell.description"></div>
                  </div>
                }
              </div>
            </section>

            <!-- Skill Order (role-specific from match data or Meraki fallback) -->
              <section class="cd-section">
                <h2 class="cd-section__title">{{ 'champion.skillOrder' | t }} ({{ selectedRole() }})</h2>

            @if (skillOrders().length > 0) {
                @for (so of skillOrders(); track so.earlySkillSequence; let first = $first) {
                  <div class="cd-build-path" [class.cd-build-path--primary]="first">
                    <div class="cd-skill-priority">
                      Start: {{ so.earlySkillSequence }}
                    </div>
                    <div class="cd-build-path__stats">
                      <span class="cd-item__wr">{{ (so.winRate * 100).toFixed(1) }}% WR</span>
                      <span class="cd-item__picks">{{ so.picks }} games</span>
                    </div>
                  </div>
                }
            }

            @if (championInfo()?.skillOrder?.levels?.length === 18) {
              @let so = championInfo()!.skillOrder!;
                <div class="cd-skill-priority" style="margin-top:0.75rem">
                  Max: {{ so.priority[0] }} > {{ so.priority[1] }} > {{ so.priority[2] }}
                </div>
                <div class="cd-skill-table">
                  <div class="cd-skill-row cd-skill-row--header">
                    <span class="cd-skill-cell cd-skill-cell--label"></span>
                    @for (lvl of levelNumbers; track lvl) {
                      <span class="cd-skill-cell">{{ lvl }}</span>
                    }
                  </div>
                  @for (key of ['Q','W','E','R']; track key) {
                    <div class="cd-skill-row">
                      <span class="cd-skill-cell cd-skill-cell--label" [class.cd-skill-cell--q]="key==='Q'" [class.cd-skill-cell--w]="key==='W'" [class.cd-skill-cell--e]="key==='E'" [class.cd-skill-cell--r]="key==='R'">{{ key }}</span>
                      @for (lvl of levelNumbers; track lvl) {
                        <span class="cd-skill-cell" [class.cd-skill-cell--active]="so.levels[lvl-1] === key" [class.cd-skill-cell--r-active]="so.levels[lvl-1] === key && key === 'R'">
                          @if (so.levels[lvl-1] === key) { <span class="cd-skill-dot"></span> }
                        </span>
                      }
                    </div>
                  }
                </div>
            }
              </section>
          </div>

          <!-- RIGHT COLUMN -->
          <div class="cd-col">

            <!-- Core Build Paths (from match data) -->
              <section class="cd-section">
                <h2 class="cd-section__title">Core Build Paths</h2>
            @if (buildOrders().length > 0) {
                @for (bo of buildOrders(); track $index; let first = $first) {
                  <div class="cd-build-path" [class.cd-build-path--primary]="first">
                    <div class="cd-core-build">
                      <img [src]="gameState.getItemImageUrl(bo.item1Id + '.png')" width="36" height="36" class="cd-core-item__img" loading="lazy" />
                      <span class="cd-core-arrow">&#x2192;</span>
                      <img [src]="gameState.getItemImageUrl(bo.item2Id + '.png')" width="36" height="36" class="cd-core-item__img" loading="lazy" />
                      <span class="cd-core-arrow">&#x2192;</span>
                      <img [src]="gameState.getItemImageUrl(bo.item3Id + '.png')" width="36" height="36" class="cd-core-item__img" loading="lazy" />
                    </div>
                    <div class="cd-build-path__stats">
                      <span class="cd-item__wr">{{ (bo.winRate * 100).toFixed(1) }}% WR</span>
                      <span class="cd-item__picks">{{ bo.picks }} games</span>
                    </div>
                  </div>
                }
            } @else if (coreItems().length > 0) {
                <div class="cd-core-build">
                  @for (item of coreItems(); track item.itemId; let last = $last) {
                    <div class="cd-core-item">
                      <img [src]="gameState.getItemImageUrl(item.itemId + '.png')" [alt]="item.itemName"
                        width="36" height="36" class="cd-core-item__img" loading="lazy" />
                      <span class="cd-core-item__name">{{ item.itemName }}</span>
                    </div>
                    @if (!last) { <span class="cd-core-arrow">&#x2192;</span> }
                  }
                </div>
            } @else {
                <div class="cd-empty">Collecting build order data...</div>
            }
              </section>

            <!-- Patch Trend Chart -->
              <section class="cd-section">
                <h2 class="cd-section__title">{{ 'trend.title' | t }}</h2>
            @if (patchTrends().length >= 2) {
                <div class="cd-trend-chart">
                  <svg [attr.viewBox]="'0 0 ' + trendChartWidth + ' ' + trendChartHeight" class="cd-trend-svg" preserveAspectRatio="none">
                    <!-- Grid lines -->
                    @for (y of trendGridLines(); track y.value) {
                      <line [attr.x1]="trendPadding.left" [attr.y1]="y.y"
                            [attr.x2]="trendChartWidth - trendPadding.right" [attr.y2]="y.y"
                            stroke="rgba(200,155,60,0.12)" stroke-width="1" />
                      <text [attr.x]="trendPadding.left - 4" [attr.y]="y.y + 3"
                            fill="var(--lol-text-muted)" font-size="9" text-anchor="end">{{ y.label }}</text>
                    }
                    <!-- 50% reference line -->
                    <line [attr.x1]="trendPadding.left" [attr.y1]="trendYScale(0.5)"
                          [attr.x2]="trendChartWidth - trendPadding.right" [attr.y2]="trendYScale(0.5)"
                          stroke="rgba(200,155,60,0.25)" stroke-width="1" stroke-dasharray="4,3" />
                    <!-- Area fill -->
                    <path [attr.d]="trendAreaPath()" fill="rgba(10,200,185,0.08)" />
                    <!-- Line -->
                    <polyline [attr.points]="trendLinePath()" fill="none"
                              stroke="var(--lol-cyan)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
                    <!-- Data points + labels -->
                    @for (pt of trendPoints(); track pt.patch) {
                      <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3.5"
                              fill="var(--lol-cyan)" stroke="rgba(1,10,19,0.8)" stroke-width="1.5" />
                      <text [attr.x]="pt.x" [attr.y]="trendChartHeight - 4"
                            fill="var(--lol-text-muted)" font-size="8" text-anchor="middle">{{ pt.patch }}</text>
                      <text [attr.x]="pt.x" [attr.y]="pt.y - 7"
                            fill="var(--lol-gold-1)" font-size="8" text-anchor="middle" font-weight="600">{{ pt.label }}</text>
                    }
                  </svg>
                </div>
            } @else {
                <div class="cd-empty">{{ 'trend.noData' | t }}</div>
            }
              </section>

            <!-- Boots -->
            @if (bootsItems().length > 0) {
              <section class="cd-section">
                <h2 class="cd-section__title">Boots</h2>
                <div class="cd-items">
                  @for (item of bootsItems(); track item.itemId) {
                    <div class="cd-item">
                      <img class="cd-item__img" [src]="gameState.getItemImageUrl(item.itemId + '.png')"
                        [alt]="item.itemName" width="36" height="36" loading="lazy" />
                      <div class="cd-item__info">
                        <div class="cd-item__name">{{ item.itemName }}</div>
                        <div class="cd-item__stats">
                          <span class="cd-item__wr">{{ winRate(item) }}% WR</span>
                          <span class="cd-item__picks">{{ item.picks }} games</span>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </section>
            }

            <!-- Starting Items -->
              <section class="cd-section">
                <h2 class="cd-section__title">Starting Items</h2>
            @if (startingItems().length > 0) {
                @for (si of startingItems(); track si.itemIds; let first = $first) {
                  <div class="cd-build-path" [class.cd-build-path--primary]="first">
                    <div class="cd-core-build">
                      @for (itemId of parseItemIds(si.itemIds); track $index) {
                        <img [src]="gameState.getItemImageUrl(itemId + '.png')" width="28" height="28"
                          class="cd-core-item__img" style="border-radius:4px" loading="lazy" />
                      }
                    </div>
                    <div class="cd-build-path__stats">
                      <span class="cd-item__wr">{{ (si.winRate * 100).toFixed(1) }}% WR</span>
                      <span class="cd-item__picks">{{ si.picks }} games</span>
                    </div>
                  </div>
                }
            } @else {
                <div class="cd-empty">Collecting starting item data...</div>
            }
              </section>

            <!-- Best Matchups -->
              <section class="cd-section">
                <h2 class="cd-section__title" style="color:#50E3C2">Best Against</h2>
            @if (bestMatchups().length > 0) {
                <div class="cd-matchups">
                  @for (m of bestMatchups(); track m.opponentChampionId) {
                    <div class="cd-matchup"
                      [class.cd-matchup--selected]="selectedMatchupId() === m.opponentChampionId"
                      (click)="onMatchupClick(m.opponentChampionId, $event)">
                      <img class="cd-matchup__img" [src]="gameState.getChampionImageUrl(m.opponentChampionKey + '.png')"
                        [alt]="m.opponentChampionKey" width="32" height="32" loading="lazy" />
                      <a class="cd-matchup__name" [routerLink]="['/champion', m.opponentChampionKey]" (click)="$event.stopPropagation()">{{ m.opponentChampionKey }}</a>
                      <span class="cd-matchup__wr">{{ (m.winRate * 100).toFixed(1) }}%</span>
                      <span class="cd-matchup__games">{{ m.picks }}g</span>
                    </div>
                  }
                </div>
            } @else {
                <div class="cd-empty">Collecting matchup data...</div>
            }
              </section>

            <!-- Worst Matchups / Counters -->
              <section class="cd-section">
                <h2 class="cd-section__title" style="color:#E84057">Countered By</h2>
            @if (worstMatchups().length > 0) {
                <div class="cd-matchups">
                  @for (m of worstMatchups(); track m.opponentChampionId) {
                    <div class="cd-matchup"
                      [class.cd-matchup--selected]="selectedMatchupId() === m.opponentChampionId"
                      (click)="onMatchupClick(m.opponentChampionId, $event)">
                      <img class="cd-matchup__img" [src]="gameState.getChampionImageUrl(m.opponentChampionKey + '.png')"
                        [alt]="m.opponentChampionKey" width="32" height="32" loading="lazy" />
                      <a class="cd-matchup__name" [routerLink]="['/champion', m.opponentChampionKey]" (click)="$event.stopPropagation()">{{ m.opponentChampionKey }}</a>
                      <span class="cd-matchup__wr cd-matchup__wr--bad">{{ (m.winRate * 100).toFixed(1) }}%</span>
                      <span class="cd-matchup__games">{{ m.picks }}g</span>
                    </div>
                  }
                </div>
            } @else {
                <div class="cd-empty">Collecting counter data...</div>
            }
              </section>

            <!-- Counter Tips (shown when a matchup is selected) -->
            @if (counterTips().length > 0) {
              <section class="cd-section cd-counter-tips">
                <h2 class="cd-section__title">{{ 'champion.counterTips' | t }}</h2>
                <div class="cd-tips-list">
                  @for (tip of counterTips(); track tip.tipKey) {
                    <div class="cd-tip" [attr.data-category]="tip.category">
                      <span class="cd-tip__badge" [class.cd-tip__badge--laning]="tip.category === 'laning'" [class.cd-tip__badge--teamfight]="tip.category === 'teamfight'" [class.cd-tip__badge--itemization]="tip.category === 'itemization'">{{ tip.category }}</span>
                      <span class="cd-tip__text">{{ tip.tipKey | t:tip.tipArgs }}</span>
                    </div>
                  }
                </div>
              </section>
            }

            <!-- Popular Items -->
              <section class="cd-section">
                <h2 class="cd-section__title">{{ 'champion.popularItems' | t }}</h2>
            @if (buildStats().length > 0) {
                <div class="cd-items">
                  @for (item of buildStats(); track item.itemId; let i = $index) {
                    <div class="cd-item" [class.cd-item--top3]="i < 3">
                      <img class="cd-item__img"
                        [src]="gameState.getItemImageUrl(item.itemId + '.png')"
                        [alt]="item.itemName"
                        width="36" height="36" loading="lazy" />
                      <div class="cd-item__info">
                        <div class="cd-item__name">{{ item.itemName }}</div>
                        <div class="cd-item__stats">
                          <span class="cd-item__wr">{{ winRate(item) }}% WR</span>
                          <span class="cd-item__picks">{{ item.picks }} games</span>
                        </div>
                      </div>
                    </div>
                  }
                </div>
            } @else {
                <div class="cd-empty">Collecting item build data from Challenger matches...</div>
            }
              </section>

            <!-- Stats -->
            <section class="cd-section">
              <h2 class="cd-section__title">{{ 'champion.stats' | t }}</h2>
              <div class="cd-stats">
                <div class="cd-stat"><span class="cd-stat__label">HP</span><span class="cd-stat__val">{{ d.stats.hp }} <small>+{{ d.stats.hpperlevel }}</small></span></div>
                <div class="cd-stat"><span class="cd-stat__label">AD</span><span class="cd-stat__val">{{ d.stats.attackdamage }} <small>+{{ d.stats.attackdamageperlevel }}</small></span></div>
                <div class="cd-stat"><span class="cd-stat__label">Armor</span><span class="cd-stat__val">{{ d.stats.armor }} <small>+{{ d.stats.armorperlevel }}</small></span></div>
                <div class="cd-stat"><span class="cd-stat__label">MR</span><span class="cd-stat__val">{{ d.stats.spellblock }} <small>+{{ d.stats.spellblockperlevel }}</small></span></div>
                <div class="cd-stat"><span class="cd-stat__label">AS</span><span class="cd-stat__val">{{ d.stats.attackspeed }} <small>+{{ d.stats.attackspeedperlevel }}%</small></span></div>
                <div class="cd-stat"><span class="cd-stat__label">MS</span><span class="cd-stat__val">{{ d.stats.movespeed }}</span></div>
                <div class="cd-stat"><span class="cd-stat__label">Range</span><span class="cd-stat__val">{{ d.stats.attackrange }}</span></div>
                <div class="cd-stat"><span class="cd-stat__label">HP Regen</span><span class="cd-stat__val">{{ d.stats.hpregen }} <small>+{{ d.stats.hpregenperlevel }}</small></span></div>
              </div>
            </section>

            <!-- Export Item Set -->
            @if (buildStats().length > 0) {
              <div style="text-align:center; margin-bottom:0.75rem">
                <button type="button" class="cd-export-btn" (click)="exportItemSet()">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                  </svg>
                  Export Item Set for LoL Client
                </button>
              </div>
            }

            <!-- Lore -->
            <section class="cd-section">
              <h2 class="cd-section__title">{{ 'champion.lore' | t }}</h2>
              <p class="cd-lore">{{ d.lore }}</p>
            </section>
          </div>
        </div>

        <!-- Tips -->
        @if (d.allytips.length > 0 || d.enemytips.length > 0) {
          <section class="cd-section cd-tips-section">
            @if (d.allytips.length > 0) {
              <h2 class="cd-section__title">{{ 'champion.tips.ally' | t }}</h2>
              <ul class="cd-tips">@for (tip of d.allytips; track $index) { <li>{{ tip }}</li> }</ul>
            }
            @if (d.enemytips.length > 0) {
              <h2 class="cd-section__title" style="margin-top:1rem">{{ 'champion.tips.enemy' | t }}</h2>
              <ul class="cd-tips">@for (tip of d.enemytips; track $index) { <li>{{ tip }}</li> }</ul>
            }
          </section>
        }

      } @else if (loading()) {
        <div class="cd-loading">
          <div class="shimmer" style="width:90px;height:90px;border-radius:50%;margin:2rem auto"></div>
          <div class="shimmer" style="width:200px;height:24px;margin:1rem auto;border-radius:2px"></div>
        </div>
      }
    </div>
  `,
  styles: [`
    .cd-page { min-height: 100vh; padding: 2rem 1rem 3rem; max-width: 1100px; margin: 0 auto; }
    .cd-loading { padding: 4rem 1rem; }

    /* Hero */
    .cd-hero { margin-bottom: 1.5rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--lol-gold-5); }
    .cd-hero__back {
      display: inline-flex; align-items: center; gap: 0.4rem;
      color: var(--lol-gold-4); text-decoration: none; font-size: 0.78rem;
      font-family: 'Cinzel', serif; letter-spacing: 0.06em; margin-bottom: 1rem; transition: color 0.15s;
    }
    .cd-hero__back:hover { color: var(--lol-gold-2); }
    .cd-hero__main { display: flex; align-items: center; gap: 1.25rem; }
    .cd-hero__portrait {
      width: 90px; height: 90px; border-radius: 50%; border: 3px solid var(--lol-gold-3);
      object-fit: cover; box-shadow: 0 0 20px rgba(200,155,60,0.3); flex-shrink: 0;
    }
    .cd-hero__name {
      font-family: 'Cinzel', serif; font-size: clamp(1.6rem, 4vw, 2.4rem);
      color: var(--lol-gold-1); letter-spacing: 0.03em; line-height: 1.1; margin-bottom: 0.2rem;
    }
    .cd-hero__title { font-style: italic; color: var(--lol-text-muted); font-size: 0.85rem; margin-bottom: 0.5rem; text-transform: capitalize; }
    .cd-hero__tags { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .cd-hero__tag, .cd-hero__pos {
      padding: 0.15rem 0.5rem; font-size: 0.6rem; font-family: 'Cinzel', serif;
      letter-spacing: 0.08em; text-transform: uppercase; border-radius: 2px;
    }
    .cd-hero__tag { color: var(--lol-cyan); border: 1px solid rgba(10,200,185,0.3); background: rgba(10,200,185,0.06); }
    .cd-hero__pos { color: var(--lol-gold-2); border: 1px solid var(--lol-gold-5); background: rgba(200,155,60,0.06); }

    /* Role tabs */
    .cd-role-tabs {
      display: flex; gap: 0.35rem; margin-bottom: 1.25rem;
      padding-bottom: 1rem; border-bottom: 1px solid var(--lol-gold-5);
    }
    .cd-role-tab {
      padding: 0.4rem 0.8rem; font-family: 'Cinzel', serif; font-size: 0.68rem;
      font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
      color: var(--lol-text-muted); background: rgba(1,10,19,0.5);
      border: 1px solid var(--lol-gold-5); border-radius: 2px; cursor: pointer; transition: all 0.15s;
    }
    .cd-role-tab:hover { color: var(--lol-gold-2); border-color: var(--lol-gold-4); }
    .cd-role-tab--active { color: var(--lol-gold-1); background: rgba(200,155,60,0.15); border-color: var(--lol-gold-3); }

    /* Grid layout */
    .cd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
    @media (max-width: 768px) { .cd-grid { grid-template-columns: 1fr; } }
    .cd-col { display: flex; flex-direction: column; gap: 1.25rem; }

    /* Section */
    .cd-section {
      padding: 1rem; background: rgba(1,10,19,0.55);
      border: 1px solid var(--lol-gold-5); border-radius: 2px;
    }
    .cd-tips-section { grid-column: 1 / -1; }
    .cd-section__title {
      font-family: 'Cinzel', serif; font-size: 0.8rem; letter-spacing: 0.12em;
      text-transform: uppercase; color: var(--lol-gold-2); margin-bottom: 0.75rem;
      padding-bottom: 0.4rem; border-bottom: 1px solid var(--lol-gold-5);
    }

    /* Runes */
    .cd-rune { padding: 0.6rem; margin-bottom: 0.5rem; background: rgba(1,10,19,0.4); border: 1px solid var(--lol-gold-5); border-radius: 2px; }
    .cd-rune--primary { border-color: var(--lol-gold-4); background: rgba(200,155,60,0.06); }
    .cd-rune__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.4rem; }
    .cd-rune__trees { font-size: 0.78rem; font-weight: 600; }
    .cd-rune__tree { font-family: 'Cinzel', serif; }
    .cd-rune__sep { color: var(--lol-text-dim); margin: 0 0.3rem; }
    .cd-rune__meta { display: flex; gap: 0.6rem; font-size: 0.68rem; }
    .cd-rune__wr { color: var(--lol-cyan); font-weight: 600; }
    .cd-rune__pr { color: var(--lol-text-muted); }
    .cd-rune__perks { display: flex; gap: 0.35rem; flex-wrap: wrap; }
    .cd-rune__perk-img {
      width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--lol-gold-5);
      background: rgba(1,10,19,0.6);
    }
    .cd-rune__perk-img--keystone { width: 34px; height: 34px; border-color: var(--lol-gold-3); }

    /* Individual Rune Table */
    .cd-rune-table { display: flex; flex-direction: column; gap: 0.75rem; }
    .cd-rune-table__slot { margin-bottom: 0.25rem; }
    .cd-rune-table__slot-label {
      font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--lol-gold-3); margin-bottom: 0.25rem; font-weight: 600;
    }
    .cd-rune-table__row {
      display: flex; align-items: center; gap: 0.4rem; padding: 0.2rem 0.4rem;
      position: relative; margin-bottom: 2px;
      background: rgba(1,10,19,0.3); border-radius: 2px;
    }
    .cd-rune-table__icon {
      width: 24px; height: 24px; border-radius: 50%;
      border: 1px solid var(--lol-gold-5); background: rgba(1,10,19,0.6);
      z-index: 1;
    }
    .cd-rune-table__bar {
      position: absolute; left: 0; top: 0; bottom: 0;
      background: linear-gradient(90deg, rgba(200,170,110,0.15), rgba(200,170,110,0.05));
      border-radius: 2px; min-width: 2%;
    }
    .cd-rune-table__wr {
      font-size: 0.75rem; font-weight: 700; color: var(--lol-gold-1);
      z-index: 1; min-width: 42px; text-align: right;
    }
    .cd-rune-table__pr {
      font-size: 0.7rem; color: var(--lol-text-muted); z-index: 1; min-width: 30px;
    }

    /* Spells */
    .cd-spell-row {
      display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem;
      margin-bottom: 0.4rem; background: rgba(1,10,19,0.4); border: 1px solid var(--lol-gold-5); border-radius: 2px;
    }
    .cd-spell-row__icons { display: flex; gap: 0.3rem; }
    .cd-spell-row__img { width: 32px; height: 32px; border-radius: 4px; border: 1px solid var(--lol-gold-5); }
    .cd-spell-row__names { flex: 1; font-size: 0.78rem; color: var(--lol-gold-1); font-weight: 500; }
    .cd-spell-row__stats { display: flex; gap: 0.5rem; font-size: 0.68rem; }
    .cd-spell-row__wr { color: var(--lol-cyan); font-weight: 600; }
    .cd-spell-row__picks { color: var(--lol-text-muted); }

    /* Matchups */
    .cd-matchups { display: flex; flex-direction: column; gap: 0.35rem; }
    .cd-matchup {
      display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.5rem;
      background: rgba(1,10,19,0.4); border: 1px solid var(--lol-gold-5); border-radius: 2px;
      text-decoration: none; transition: all 0.15s;
    }
    .cd-matchup:hover { border-color: var(--lol-gold-4); background: rgba(200,155,60,0.06); cursor: pointer; }
    .cd-matchup--selected { border-color: var(--lol-gold-3); background: rgba(200,155,60,0.12); box-shadow: 0 0 6px rgba(200,155,60,0.2); }
    .cd-matchup__img { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--lol-gold-5); }
    .cd-matchup__name { flex: 1; font-size: 0.78rem; color: var(--lol-gold-1); font-weight: 500; text-decoration: none; }
    .cd-matchup__name:hover { text-decoration: underline; color: var(--lol-gold-2); }
    .cd-matchup__wr { font-size: 0.75rem; font-weight: 700; color: var(--lol-cyan); }
    .cd-matchup__wr--bad { color: #E84057; }
    .cd-matchup__games { font-size: 0.65rem; color: var(--lol-text-muted); min-width: 30px; text-align: right; }

    /* Counter Tips */
    .cd-counter-tips { border-color: var(--lol-gold-3); background: rgba(200,155,60,0.04); }
    .cd-tips-list { display: flex; flex-direction: column; gap: 0.4rem; }
    .cd-tip {
      display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.5rem 0.6rem;
      background: rgba(1,10,19,0.4); border: 1px solid var(--lol-gold-5); border-radius: 2px;
      border-left: 3px solid var(--lol-gold-4);
    }
    .cd-tip__badge {
      flex-shrink: 0; padding: 0.1rem 0.4rem; font-size: 0.55rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.05em; border-radius: 2px;
      font-family: 'Cinzel', serif;
    }
    .cd-tip__badge--laning { color: #50E3C2; background: rgba(80,227,194,0.12); border: 1px solid rgba(80,227,194,0.3); }
    .cd-tip__badge--teamfight { color: #9B6FE3; background: rgba(155,111,227,0.12); border: 1px solid rgba(155,111,227,0.3); }
    .cd-tip__badge--itemization { color: #F5A623; background: rgba(245,166,35,0.12); border: 1px solid rgba(245,166,35,0.3); }
    .cd-tip__text { font-size: 0.75rem; line-height: 1.45; color: var(--lol-gold-1); }

    /* Items */
    .cd-items { display: flex; flex-direction: column; gap: 0.35rem; }
    .cd-item {
      display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.5rem;
      background: rgba(1,10,19,0.4); border: 1px solid var(--lol-gold-5); border-radius: 2px;
    }
    .cd-item--top3 { border-color: var(--lol-gold-4); background: rgba(200,155,60,0.06); }
    .cd-item__img { border-radius: 2px; border: 1px solid var(--lol-gold-5); flex-shrink: 0; }
    .cd-item__name { font-size: 0.78rem; font-weight: 600; color: var(--lol-gold-1); }
    .cd-item__stats { display: flex; gap: 0.5rem; font-size: 0.68rem; }
    .cd-item__wr { color: var(--lol-cyan); font-weight: 600; }
    .cd-item__picks { color: var(--lol-text-muted); }

    /* Stats */
    .cd-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; }
    .cd-stat { display: flex; justify-content: space-between; padding: 0.3rem 0.5rem; background: rgba(200,155,60,0.04); border-radius: 2px; }
    .cd-stat__label { font-size: 0.72rem; color: var(--lol-text-muted); font-weight: 600; }
    .cd-stat__val { font-size: 0.75rem; color: var(--lol-gold-1); font-weight: 600; }
    .cd-stat__val small { color: var(--lol-gold-4); font-weight: 400; font-size: 0.65rem; }

    /* Abilities */
    .cd-abilities { display: flex; flex-direction: column; gap: 0.6rem; }
    .cd-ability { padding: 0.6rem; background: rgba(1,10,19,0.4); border: 1px solid var(--lol-gold-5); border-radius: 2px; }
    .cd-ability__header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem; }
    .cd-ability__icon { width: 36px; height: 36px; border-radius: 4px; border: 1px solid var(--lol-gold-4); flex-shrink: 0; }
    .cd-ability__key {
      width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center;
      font-family: 'Cinzel', serif; font-size: 0.65rem; font-weight: 700;
      color: var(--lol-gold-1); background: rgba(200,155,60,0.15);
      border: 1px solid var(--lol-gold-4); border-radius: 2px; flex-shrink: 0;
    }
    .cd-ability__key--passive { color: var(--lol-cyan); background: rgba(10,200,185,0.12); border-color: rgba(10,200,185,0.4); }
    .cd-ability__name { font-weight: 600; font-size: 0.82rem; color: var(--lol-gold-1); }
    .cd-ability__meta { display: flex; gap: 0.6rem; font-size: 0.65rem; color: var(--lol-text-muted); margin-bottom: 0.3rem; }
    .cd-ability__desc { font-size: 0.73rem; line-height: 1.5; color: var(--lol-gold-1); }

    /* Tips */
    .cd-tips { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .cd-tips li {
      padding: 0.4rem 0.6rem; font-size: 0.75rem; line-height: 1.45; color: var(--lol-gold-1);
      background: rgba(1,10,19,0.4); border-left: 2px solid var(--lol-gold-4); border-radius: 0 2px 2px 0;
    }

    /* Skill Order table */
    .cd-skill-priority {
      font-size: 0.78rem; color: var(--lol-gold-2); font-weight: 600; margin-bottom: 0.6rem;
      font-family: 'Cinzel', serif; letter-spacing: 0.05em;
    }
    .cd-skill-table { overflow-x: auto; }
    .cd-skill-row { display: flex; gap: 1px; }
    .cd-skill-row--header { margin-bottom: 2px; }
    .cd-skill-cell {
      width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
      font-size: 0.55rem; font-weight: 600; color: var(--lol-text-dim);
      background: rgba(1,10,19,0.4); border-radius: 1px; flex-shrink: 0;
    }
    .cd-skill-cell--label {
      width: 28px; font-family: 'Cinzel', serif; font-size: 0.7rem; font-weight: 700;
      background: transparent; color: var(--lol-gold-2);
    }
    .cd-skill-cell--q { color: #4A90E2; }
    .cd-skill-cell--w { color: #50E3C2; }
    .cd-skill-cell--e { color: #F5A623; }
    .cd-skill-cell--r { color: #D0021B; }
    .cd-skill-cell--active { background: rgba(74,144,226,0.35); }
    .cd-skill-cell--r-active { background: rgba(208,2,27,0.3); }
    .cd-skill-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }

    /* Core Build Path */
    .cd-core-build {
      display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; justify-content: center;
    }
    .cd-core-item { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
    .cd-core-item__img { border-radius: 4px; border: 2px solid var(--lol-gold-4); }
    .cd-core-item__name { font-size: 0.62rem; color: var(--lol-gold-2); text-align: center; max-width: 70px; line-height: 1.2; }
    .cd-core-arrow { font-size: 1.2rem; color: var(--lol-gold-3); font-weight: 700; }
    .cd-build-path {
      display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;
      padding: 0.5rem; margin-bottom: 0.4rem; background: rgba(1,10,19,0.4);
      border: 1px solid var(--lol-gold-5); border-radius: 2px;
    }
    .cd-build-path--primary { border-color: var(--lol-gold-4); background: rgba(200,155,60,0.06); }
    .cd-build-path__stats { display: flex; gap: 0.5rem; font-size: 0.68rem; flex-shrink: 0; }

    /* Trend chart */
    .cd-trend-chart { padding: 0.25rem 0; }
    .cd-trend-svg { width: 100%; height: auto; display: block; }

    /* Empty state */
    .cd-empty {
      padding: 1rem; text-align: center; font-size: 0.78rem; color: var(--lol-text-dim);
      font-style: italic; background: rgba(200,155,60,0.04); border-radius: 2px;
      border: 1px dashed var(--lol-gold-5);
    }

    /* Export button */
    .cd-export-btn {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.45rem 1rem; font-family: 'Cinzel', serif; font-size: 0.68rem;
      font-weight: 600; letter-spacing: 0.06em; color: var(--lol-gold-1);
      background: rgba(200,155,60,0.12); border: 1px solid var(--lol-gold-4);
      border-radius: 2px; cursor: pointer; transition: all 0.15s;
    }
    .cd-export-btn:hover { background: rgba(200,155,60,0.2); border-color: var(--lol-gold-3); }

    /* Lore */
    .cd-lore { font-size: 0.78rem; line-height: 1.6; color: var(--lol-text-muted); font-style: italic; }
  `],
})
export class ChampionDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private seo = inject(SeoService);
  readonly gameState = inject(GameStateService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly detail = signal<DDragonChampionDetail | null>(null);
  readonly championInfo = signal<Champion | null>(null);
  readonly buildStats = signal<ChampionBuildStat[]>([]);
  readonly runes = signal<RunePage[]>([]);
  readonly individualRunes = signal<IndividualRuneStat[]>([]);
  readonly spells = signal<SpellSet[]>([]);
  readonly matchups = signal<MatchupStat[]>([]);
  readonly buildOrders = signal<BuildOrderEntry[]>([]);
  readonly skillOrders = signal<SkillOrderEntry[]>([]);
  readonly startingItems = signal<StartingItemEntry[]>([]);
  readonly patchTrends = signal<PatchTrend[]>([]);
  readonly counterTips = signal<CounterTip[]>([]);
  readonly selectedMatchupId = signal<number | null>(null);
  readonly selectedRole = signal<string>('');

  /** Matchups where we WIN (highest WR) — "best against" */
  readonly bestMatchups = computed(() =>
    this.matchups().filter(m => m.winRate >= 0.5).slice(0, 5)
  );

  /** Matchups where we LOSE (lowest WR) — "worst against / counters" */
  readonly worstMatchups = computed(() => {
    const sorted = [...this.matchups()].sort((a, b) => a.winRate - b.winRate);
    return sorted.filter(m => m.winRate < 0.5).slice(0, 5);
  });
  readonly loading = signal(true);
  readonly spellKeys = SPELL_KEYS;
  readonly levelNumbers = Array.from({ length: 18 }, (_, i) => i + 1);

  /** Known boots item IDs for filtering. */
  private static readonly BOOTS_IDS = new Set([
    3006, 3009, 3020, 3047, 3111, 3117, 3158,
  ]);

  /** Top 3 non-boots items as core build path. */
  readonly coreItems = computed(() =>
    this.buildStats().filter(i => !ChampionDetailComponent.BOOTS_IDS.has(i.itemId)).slice(0, 3)
  );

  /** Boots items only. */
  readonly bootsItems = computed(() =>
    this.buildStats().filter(i => ChampionDetailComponent.BOOTS_IDS.has(i.itemId))
  );

  // ── Patch Trend chart geometry ──────────────────────────────────────
  readonly trendChartWidth = 320;
  readonly trendChartHeight = 140;
  readonly trendPadding = { top: 18, right: 10, bottom: 18, left: 36 };

  readonly trendPoints = computed(() => {
    const data = this.patchTrends();
    if (data.length < 2) return [];
    const wrs = data.map(d => d.winRate);
    const minWr = Math.min(...wrs);
    const maxWr = Math.max(...wrs);
    const range = maxWr - minWr || 0.01;
    const plotW = this.trendChartWidth - this.trendPadding.left - this.trendPadding.right;
    const plotH = this.trendChartHeight - this.trendPadding.top - this.trendPadding.bottom;
    return data.map((d, i) => ({
      patch: d.patch,
      x: this.trendPadding.left + (i / (data.length - 1)) * plotW,
      y: this.trendPadding.top + (1 - (d.winRate - minWr) / range) * plotH,
      label: (d.winRate * 100).toFixed(1) + '%',
    }));
  });

  trendLinePath(): string {
    return this.trendPoints().map(p => `${p.x},${p.y}`).join(' ');
  }

  trendAreaPath(): string {
    const pts = this.trendPoints();
    if (pts.length < 2) return '';
    const bottom = this.trendChartHeight - this.trendPadding.bottom;
    return `M${pts[0].x},${bottom} ` +
      pts.map(p => `L${p.x},${p.y}`).join(' ') +
      ` L${pts[pts.length - 1].x},${bottom} Z`;
  }

  trendYScale(wr: number): number {
    const data = this.patchTrends();
    if (data.length < 2) return this.trendChartHeight / 2;
    const wrs = data.map(d => d.winRate);
    const minWr = Math.min(...wrs);
    const maxWr = Math.max(...wrs);
    const range = maxWr - minWr || 0.01;
    const plotH = this.trendChartHeight - this.trendPadding.top - this.trendPadding.bottom;
    return this.trendPadding.top + (1 - (wr - minWr) / range) * plotH;
  }

  readonly trendGridLines = computed(() => {
    const data = this.patchTrends();
    if (data.length < 2) return [];
    const wrs = data.map(d => d.winRate);
    const minWr = Math.min(...wrs);
    const maxWr = Math.max(...wrs);
    const range = maxWr - minWr || 0.01;
    const plotH = this.trendChartHeight - this.trendPadding.top - this.trendPadding.bottom;
    const steps = 3;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const value = minWr + (range * i) / steps;
      return {
        value,
        y: this.trendPadding.top + (1 - (value - minWr) / range) * plotH,
        label: (value * 100).toFixed(1) + '%',
      };
    });
  });

  version(): string {
    return this.gameState.ddragonVersion();
  }

  ngOnInit(): void {
    const key = this.route.snapshot.paramMap.get('key') ?? '';

    this.seo.updatePageMeta({
      title: `${key} Build — Counter Items & Best Build | DraftSense`,
      description: `Best ${key} build for League of Legends. Runes, summoner spells, counter matchups, skill order, and item builds from Challenger data.`,
      url: `https://draftsense.net/champion/${key}`,
    });

    if (!this.isBrowser) return;

    const version = this.gameState.ddragonVersion();

    forkJoin({
      detail: this.api.getChampionDetail(key, version),
      champions: this.api.getChampions(),
    }).subscribe({
      next: ({ detail, champions }) => {
        this.detail.set(detail);
        const info = champions.find((c) => c.key === key) ?? null;
        this.championInfo.set(info);
        this.loading.set(false);

        this.seo.updatePageMeta({
          title: `${detail.name} Build — Counter Items & Best Build | DraftSense`,
          description: `Best ${detail.name} build for LoL. ${detail.title}. Runes, summoner spells, counter matchups, and Challenger meta builds.`,
          url: `https://draftsense.net/champion/${key}`,
        });

        if (info && info.positions.length > 0) {
          this.selectedRole.set(info.positions[0]);
          this.loadRoleData(info.id, info.positions[0]);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  switchRole(role: string): void {
    this.selectedRole.set(role);
    const info = this.championInfo();
    if (info) this.loadRoleData(info.id, role);
  }

  private loadRoleData(championId: number, lane: string): void {
    this.buildStats.set([]);
    this.runes.set([]);
    this.spells.set([]);
    this.matchups.set([]);
    this.buildOrders.set([]);
    this.skillOrders.set([]);
    this.startingItems.set([]);
    this.patchTrends.set([]);
    this.counterTips.set([]);
    this.selectedMatchupId.set(null);

    this.api.getChampionBuildStats(championId, lane).subscribe({
      next: (stats) => this.buildStats.set(stats),
      error: () => {},
    });
    this.api.getChampionRunes(championId, lane).subscribe({
      next: (r) => this.runes.set(r),
      error: () => {},
    });
    this.api.getIndividualRuneStats(championId, lane).subscribe({
      next: (r) => this.individualRunes.set(r),
      error: () => {},
    });
    this.api.getChampionSpells(championId, lane).subscribe({
      next: (s) => this.spells.set(s),
      error: () => {},
    });
    this.api.getChampionMatchups(championId, lane).subscribe({
      next: (m) => this.matchups.set(m),
      error: () => {},
    });
    this.api.getChampionBuildOrders(championId, lane).subscribe({
      next: (bo) => this.buildOrders.set(bo),
      error: () => {},
    });
    this.api.getChampionSkillOrders(championId, lane).subscribe({
      next: (so) => this.skillOrders.set(so),
      error: () => {},
    });
    this.api.getChampionStartingItems(championId, lane).subscribe({
      next: (si) => this.startingItems.set(si),
      error: () => {},
    });
    this.api.getPatchTrends(championId, lane).subscribe({
      next: (trends) => this.patchTrends.set(trends),
      error: () => {},
    });
  }

  onMatchupClick(opponentId: number, _event: Event): void {
    const info = this.championInfo();
    if (!info) return;

    // Toggle: clicking the same matchup hides tips
    if (this.selectedMatchupId() === opponentId) {
      this.selectedMatchupId.set(null);
      this.counterTips.set([]);
      return;
    }

    this.selectedMatchupId.set(opponentId);
    this.counterTips.set([]);
    this.api.getCounterTips(info.id, opponentId).subscribe({
      next: (tips) => this.counterTips.set(tips),
    });
  }

  winRate(item: ChampionBuildStat): string {
    if (item.picks === 0) return '0';
    return ((item.wins / item.picks) * 100).toFixed(1);
  }

  runeTreeName(id: number): string {
    return RUNE_TREES[id]?.name ?? `Tree ${id}`;
  }

  runeTreeColor(id: number): string {
    return RUNE_TREES[id]?.color ?? '#C8AA6E';
  }

  spellName(id: number): string {
    return SUMMONER_SPELLS[id]?.name ?? `Spell ${id}`;
  }

  spellImgUrl(id: number): string {
    const v = this.version();
    const img = SUMMONER_SPELLS[id]?.img ?? 'SummonerFlash.png';
    return `https://ddragon.leagueoflegends.com/cdn/${v}/img/spell/${img}`;
  }

  exportItemSet(): void {
    const d = this.detail();
    const info = this.championInfo();
    if (!d || !info) return;

    const coreIds = this.coreItems().map(i => ({ id: String(i.itemId), count: 1 }));
    const bootsIds = this.bootsItems().map(i => ({ id: String(i.itemId), count: 1 }));
    const allIds = this.buildStats().map(i => ({ id: String(i.itemId), count: 1 }));

    const itemSet = {
      title: `DraftSense - ${d.name} ${this.selectedRole()}`,
      type: 'custom',
      map: 'any',
      mode: 'any',
      priority: false,
      sortrank: 0,
      champion: d.id,
      blocks: [
        { type: 'Core Build', items: coreIds },
        ...(bootsIds.length > 0 ? [{ type: 'Boots', items: bootsIds }] : []),
        { type: 'All Popular Items', items: allIds },
      ],
    };

    const blob = new Blob([JSON.stringify(itemSet, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DraftSense_${d.id}_${this.selectedRole()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  parseItemIds(ids: string): number[] {
    return ids.split(',').map(Number).filter(id => id > 0);
  }

  perkIconUrl(perkId: number): string {
    return PERK_ICONS[perkId] ?? '';
  }

  individualRunesBySlot(slot: number): IndividualRuneStat[] {
    return this.individualRunes().filter(r => r.slot === slot);
  }

  onPerkImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}
