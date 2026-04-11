import { Component, Input, OnChanges, inject, signal, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BuildRecommendation, BuildVariant } from '../../core/models/build-recommendation.model';
import { TPipe } from '../../shared/pipes/t.pipe';
import { TranslationService } from '../../core/services/translation.service';
import { TranslationKey } from '../../core/i18n/translations';

@Component({
  selector: 'app-build-panel',
  standalone: true,
  imports: [CommonModule, TPipe],
  template: `
    @if (recommendation) {
      <div class="glass-card overflow-hidden animate-in">
        <!-- Hero header — ONLY champion splash + name. No stats here so users
             don't confuse enemy team composition with the champion's own kit. -->
        <div class="relative overflow-hidden">
          <div class="absolute inset-0"
               [style.background-image]="'url(' + splashUrl() + ')'"
               style="background-size: cover; background-position: center 20%; filter: brightness(0.35) saturate(1.15);"></div>
          <div class="absolute inset-0"
               style="background: linear-gradient(180deg, rgba(1,10,19,0.2) 0%, rgba(1,10,19,0.92) 100%);"></div>

          <div class="relative px-6 py-6 md:py-8">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-full gold-border-bright flex items-center justify-center"
                   style="background: radial-gradient(circle, rgba(200,155,60,0.25), transparent 70%);">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="var(--lol-gold-3)">
                  <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"/>
                </svg>
              </div>
              <div>
                <div class="text-xs font-display uppercase tracking-widest text-gold-soft mb-1">Recommended Build</div>
                <h2 class="text-3xl md:text-4xl font-display text-gold-lite">{{ recommendation.championName }}</h2>
              </div>
            </div>
          </div>
        </div>

        <!-- Enemy team threat profile — SEPARATE SECTION, clearly labeled as the
             opposing team's composition, not the champion's own stats. Red accent
             so it visually "belongs" to the enemy side. -->
        <div class="enemy-threat-section">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="var(--lol-red)" class="shrink-0">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v6h-2V7zm0 8h2v2h-2v-2z"/>
              </svg>
              <h3 class="font-display uppercase tracking-widest text-sm" style="color: var(--lol-red)">{{ 'build.threatProfile.title' | t }}</h3>
            </div>
            <span class="text-[10px] text-muted uppercase tracking-wider">{{ 'build.threatProfile.subtitle' | t }}</span>
          </div>
          <!-- Primary threats: the 5 core dimensions every build considers. -->
          <div class="grid grid-cols-5 gap-2 md:gap-4">
            <div class="threat-pill">
              <div class="threat-label">{{ 'build.threat.ad' | t }}</div>
              <div class="threat-bar-wrap">
                <div class="threat-bar" style="background: linear-gradient(90deg, #F59E0B, #EF4444);"
                     [style.width.%]="recommendation.enemyThreatProfile.adRatio * 100"></div>
              </div>
              <div class="threat-value">{{ (recommendation.enemyThreatProfile.adRatio * 100).toFixed(0) }}%</div>
            </div>
            <div class="threat-pill">
              <div class="threat-label">{{ 'build.threat.ap' | t }}</div>
              <div class="threat-bar-wrap">
                <div class="threat-bar" style="background: linear-gradient(90deg, #A855F7, #EC4899);"
                     [style.width.%]="recommendation.enemyThreatProfile.apRatio * 100"></div>
              </div>
              <div class="threat-value">{{ (recommendation.enemyThreatProfile.apRatio * 100).toFixed(0) }}%</div>
            </div>
            <div class="threat-pill">
              <div class="threat-label">{{ 'build.threat.heal' | t }}</div>
              <div class="threat-bar-wrap">
                <div class="threat-bar" style="background: linear-gradient(90deg, #10B981, #34D399);"
                     [style.width.%]="recommendation.enemyThreatProfile.healingThreat * 100"></div>
              </div>
              <div class="threat-value">{{ (recommendation.enemyThreatProfile.healingThreat * 100).toFixed(0) }}%</div>
            </div>
            <div class="threat-pill">
              <div class="threat-label">{{ 'build.threat.cc' | t }}</div>
              <div class="threat-bar-wrap">
                <div class="threat-bar" style="background: linear-gradient(90deg, #0AC8B9, #3B82F6);"
                     [style.width.%]="recommendation.enemyThreatProfile.ccThreat * 100"></div>
              </div>
              <div class="threat-value">{{ (recommendation.enemyThreatProfile.ccThreat * 100).toFixed(0) }}%</div>
            </div>
            <div class="threat-pill">
              <div class="threat-label">{{ 'build.threat.tank' | t }}</div>
              <div class="threat-bar-wrap">
                <div class="threat-bar" style="background: linear-gradient(90deg, #6B7280, #9CA3AF);"
                     [style.width.%]="recommendation.enemyThreatProfile.tankLevel * 100"></div>
              </div>
              <div class="threat-value">{{ (recommendation.enemyThreatProfile.tankLevel * 100).toFixed(0) }}%</div>
            </div>
          </div>
          <!-- Contextual threats: only drive picks when they exceed baseline. Shown
               below as compact pills so they don't compete visually with the core 5. -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mt-2">
            <div class="threat-pill threat-pill--secondary">
              <div class="threat-label">{{ 'build.threat.shield' | t }}</div>
              <div class="threat-bar-wrap">
                <div class="threat-bar" style="background: linear-gradient(90deg, #06B6D4, #67E8F9);"
                     [style.width.%]="recommendation.enemyThreatProfile.shieldThreat * 100"></div>
              </div>
              <div class="threat-value">{{ (recommendation.enemyThreatProfile.shieldThreat * 100).toFixed(0) }}%</div>
            </div>
            <div class="threat-pill threat-pill--secondary">
              <div class="threat-label">{{ 'build.threat.engage' | t }}</div>
              <div class="threat-bar-wrap">
                <div class="threat-bar" style="background: linear-gradient(90deg, #DC2626, #F97316);"
                     [style.width.%]="recommendation.enemyThreatProfile.engageThreat * 100"></div>
              </div>
              <div class="threat-value">{{ (recommendation.enemyThreatProfile.engageThreat * 100).toFixed(0) }}%</div>
            </div>
            <div class="threat-pill threat-pill--secondary">
              <div class="threat-label">{{ 'build.threat.poke' | t }}</div>
              <div class="threat-bar-wrap">
                <div class="threat-bar" style="background: linear-gradient(90deg, #EAB308, #FACC15);"
                     [style.width.%]="recommendation.enemyThreatProfile.pokeThreat * 100"></div>
              </div>
              <div class="threat-value">{{ (recommendation.enemyThreatProfile.pokeThreat * 100).toFixed(0) }}%</div>
            </div>
            <div class="threat-pill threat-pill--secondary">
              <div class="threat-label">{{ 'build.threat.trueDmg' | t }}</div>
              <div class="threat-bar-wrap">
                <div class="threat-bar" style="background: linear-gradient(90deg, #FBBF24, #FDE68A);"
                     [style.width.%]="recommendation.enemyThreatProfile.trueDamageThreat * 100"></div>
              </div>
              <div class="threat-value">{{ (recommendation.enemyThreatProfile.trueDamageThreat * 100).toFixed(0) }}%</div>
            </div>
          </div>
          <!-- Situational flags: only rendered when the condition holds, so players
               see them only when they actually matter. -->
          @if (recommendation.enemyThreatProfile.hasCritCarry || recommendation.enemyThreatProfile.hasInvisibleEnemy) {
            <div class="flex flex-wrap gap-2 mt-3">
              @if (recommendation.enemyThreatProfile.hasCritCarry) {
                <span class="threat-chip">{{ 'build.chip.critCarry' | t }}</span>
              }
              @if (recommendation.enemyThreatProfile.hasInvisibleEnemy) {
                <span class="threat-chip">{{ 'build.chip.invisible' | t }}</span>
              }
            </div>
          }
        </div>

        <div class="p-6">
          <!-- Role anomaly banner — shown when champion is in an unusual role
               (e.g., Aatrox assigned UTILITY) and we fell back to their natural meta. -->
          @if (recommendation.anomaly; as anom) {
            <div class="anomaly-banner mb-5 animate-in">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="var(--lol-gold-3)" class="shrink-0 mt-0.5">
                <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 16h2v2h-2zm0-6h2v5h-2z"/>
              </svg>
              <div>
                <div class="font-display text-sm uppercase tracking-widest text-gold mb-1">{{ 'build.anomaly.title' | t }}</div>
                <!-- resolveAnomalyArgs first localizes the lane tokens (e.g. lane.top
                     → "Top" in the current language), then the outer pipe renders the
                     anomaly key with the resolved args. Two-level resolution keeps the
                     backend payload entirely locale-agnostic. -->
                <div class="text-xs text-gold-soft leading-relaxed">{{ anom.key | t:resolveAnomalyArgs(anom.args) }}</div>
              </div>
            </div>
          }

          <!-- Variant tabs — Standard / Aggressive / Defensive.
               Both label and description come from the backend as translation
               keys (labelKey/descriptionKey), so switching language flips them
               instantly without a round-trip. -->
          <div class="flex gap-2 mb-4 flex-wrap">
            @for (variant of recommendation.variants; track variant.style) {
              <button
                type="button"
                (click)="selectVariant(variant.style)"
                class="variant-tab"
                [class.active]="selectedStyle() === variant.style"
              >
                <span class="variant-icon" [innerHTML]="variantIcon(variant.style)"></span>
                <span>{{ variant.labelKey | t }}</span>
              </button>
            }
          </div>

          @if (currentVariant(); as variant) {
            <div class="text-sm text-muted italic mb-6">{{ variant.descriptionKey | t }}</div>

            <!-- Rush components — sub-components that need to be bought early even though
                 the final item sits later in the buy order (e.g., Tear of the Goddess for
                 Manamune builds, because the passive stacks over time). -->
            @if (variant.earlyComponents?.length) {
              <div class="rush-section mb-6 animate-in">
                <div class="flex items-center gap-2 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="var(--lol-gold-3)" class="shrink-0">
                    <path d="M13 3l3.293 3.293-7 7 1.414 1.414 7-7L21 11V3z"/>
                    <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7z"/>
                  </svg>
                  <h3 class="font-display uppercase tracking-widest text-sm text-gold-soft">
                    {{ 'build.rush.title' | t }}
                  </h3>
                </div>
                <div class="flex flex-wrap gap-3">
                  @for (ec of variant.earlyComponents; track ec.component.id) {
                    <div class="rush-card">
                      <div class="rush-card-body">
                        <div class="rush-icon-wrap">
                          <img
                            [src]="itemImageUrl(ec.component)"
                            [alt]="ec.component.name"
                            class="rush-icon"
                            (error)="onImgError($event)"
                          />
                        </div>
                        <div class="rush-arrow" aria-hidden="true">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
                          </svg>
                        </div>
                        <div class="rush-target-wrap">
                          <img
                            [src]="itemImageUrl(ec.buildsInto)"
                            [alt]="ec.buildsInto.name"
                            class="rush-target"
                            (error)="onImgError($event)"
                          />
                        </div>
                      </div>
                      <div class="rush-card-text">
                        <div class="rush-title">
                          <span class="text-gold-lite font-display">{{ ec.component.name }}</span>
                          <span class="text-muted text-[10px] ml-1">→ {{ ec.buildsInto.name }}</span>
                        </div>
                        <div class="rush-reason">{{ ec.reasonKey | t:ec.reasonArgs }}</div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Build Order header -->
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="var(--lol-gold-3)">
                  <path d="M3 17h18v2H3zm16-5v1H5v-1c0-2.76 2.24-5 5-5h4c2.76 0 5 2.24 5 5zm-9-8c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/>
                </svg>
                <h3 class="font-display uppercase tracking-widest text-sm text-gold-soft">{{ 'build.order.title' | t }}</h3>
              </div>
              <div class="text-xs text-muted">
                {{ 'build.order.totalCost' | t }}
                <span class="font-display text-gold text-base ml-1">{{ totalGold(variant) }}g</span>
              </div>
            </div>

            <!-- Items row with arrows between -->
            <div class="flex flex-wrap items-stretch justify-center gap-1 md:gap-2">
              @for (rec of variant.items; track rec.item.id; let i = $index; let isLast = $last) {
                <div class="item-card group">
                  <!-- Step number badge -->
                  <div class="step-badge">{{ i + 1 }}</div>

                  <!-- Item icon with hover glow -->
                  <div class="item-icon-wrap">
                    <img
                      [src]="itemImageUrl(rec.item)"
                      [alt]="rec.item.name"
                      class="item-icon"
                      (error)="onImgError($event)"
                    />
                  </div>

                  <div class="item-name">{{ rec.item.name }}</div>
                  <div class="item-gold">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93V18h-2v1.93c-3.94-.49-7.05-3.6-7.54-7.54L5 12v-1.93C5.49 6.13 8.6 3.02 12.54 2.53L12 2V3.93c3.94.49 7.05 3.6 7.54 7.54L18 12v1.93c-.49 3.94-3.6 7.05-7.54 7.54z"/>
                    </svg>
                    {{ rec.item.gold.total }}
                  </div>

                  <!-- Reasons revealed on hover via tooltip. Each reason is a
                       {key, args} DTO from the backend; the t pipe resolves it to
                       the user's active language with placeholder substitution. -->
                  @if (rec.reasons.length > 0) {
                    <div class="item-reasons">
                      @for (reason of rec.reasons; track reason.key) {
                        <div class="text-[10px] text-muted leading-tight">· {{ reason.key | t:reason.args }}</div>
                      }
                    </div>
                  }
                </div>

                @if (!isLast) {
                  <div class="build-arrow" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                      <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
                    </svg>
                  </div>
                }
              }
            </div>

            <!-- Skill Order section — level-by-level skill progression from L1 to L18.
                 Each cell shows which ability to level up at that champion level.
                 Derived from Meraki ability leveling data + standard LoL maxing rule
                 (all basics by L3, R at 6/11/16, then max priority[0]→[1]→[2]).
                 Hidden for pure utility champs (Yuumi etc.) where Meraki doesn't
                 expose damage scaling. -->
            @if (recommendation.skillOrder; as skills) {
              <div class="skill-section mt-8">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="var(--lol-gold-3)">
                      <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
                    </svg>
                    <h3 class="font-display uppercase tracking-widest text-sm text-gold-soft">{{ 'build.skillOrder.title' | t }}</h3>
                  </div>
                  <div class="text-[10px] text-muted uppercase tracking-wider">{{ skills.source }}</div>
                </div>

                <!-- 18-level grid — each cell = one champion level, labeled with the
                     ability to learn/level at that level. R cells get cyan accent,
                     priority[0] (the skill maxed first) gets the bright gold treatment. -->
                <div class="skill-grid" role="list" [attr.aria-label]="'build.skillOrder.ariaLabel' | t">
                  @for (slot of skills.levels; track $index) {
                    <div class="skill-cell"
                         [class.skill-cell-primary]="isMaxFirstSlot(skills, slot)"
                         [class.skill-cell-ult]="slot === 'R'"
                         role="listitem">
                      <div class="skill-cell-level">{{ $index + 1 }}</div>
                      <div class="skill-cell-slot">{{ slot }}</div>
                    </div>
                  }
                </div>

              </div>
            }
          }
        </div>
      </div>
    }
  `,
  styles: [`
    /* Separates enemy team composition from the champion hero above it.
       Red accent + distinct background so users never read these bars as
       the champion's own stats — they're what the ENEMY team brings. */
    .enemy-threat-section {
      padding: 1rem 1.5rem 1.25rem 1.5rem;
      background: linear-gradient(90deg,
        rgba(232, 64, 87, 0.10) 0%,
        rgba(232, 64, 87, 0.02) 60%,
        rgba(1, 10, 19, 0.4) 100%);
      border-top: 1px solid rgba(232, 64, 87, 0.35);
      border-bottom: 1px solid var(--lol-gold-5);
      border-left: 3px solid var(--lol-red);
    }

    .threat-pill {
      text-align: center;
    }
    .threat-label {
      font-size: 0.65rem;
      font-family: 'Cinzel', serif;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--lol-gold-2);
      margin-bottom: 0.25rem;
    }
    .threat-bar-wrap {
      height: 4px;
      background: rgba(1, 10, 19, 0.6);
      border: 1px solid var(--lol-gold-5);
      border-radius: 2px;
      overflow: hidden;
    }
    .threat-bar {
      height: 100%;
      transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 0 8px currentColor;
    }
    .threat-value {
      font-size: 0.75rem;
      font-weight: 600;
      margin-top: 0.25rem;
      color: var(--lol-gold-1);
    }
    /* Secondary threat pills — visually de-emphasized so Shield/Engage/Poke/%HP
       don't compete with the core AD/AP/Heal/CC/Tank row above them. */
    .threat-pill--secondary .threat-label {
      font-size: 0.55rem;
      color: var(--lol-gold-3);
      opacity: 0.85;
    }
    .threat-pill--secondary .threat-bar-wrap {
      height: 3px;
    }
    .threat-pill--secondary .threat-value {
      font-size: 0.65rem;
      opacity: 0.85;
    }
    /* Situational flag chips (crit carry, invisible enemy) — bright but compact so
       they read as "hey, watch out for this" alongside the numeric bars. */
    .threat-chip {
      display: inline-flex;
      align-items: center;
      padding: 0.3rem 0.65rem;
      background: rgba(200, 155, 60, 0.08);
      border: 1px solid var(--lol-gold-4);
      border-radius: 999px;
      font-size: 0.7rem;
      font-family: 'Cinzel', serif;
      letter-spacing: 0.08em;
      color: var(--lol-gold-2);
    }

    .variant-tab {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      background: rgba(1, 10, 19, 0.6);
      border: 1px solid var(--lol-gold-5);
      color: var(--lol-text-muted);
      font-family: 'Cinzel', serif;
      font-size: 0.8rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .variant-tab:hover {
      border-color: var(--lol-gold-4);
      color: var(--lol-gold-2);
    }
    .variant-tab.active {
      background: linear-gradient(180deg, rgba(200, 155, 60, 0.2), rgba(200, 155, 60, 0.05));
      border-color: var(--lol-gold-3);
      color: var(--lol-gold-1);
      box-shadow:
        0 0 0 1px var(--lol-gold-3),
        0 4px 16px rgba(200, 155, 60, 0.25);
    }
    .variant-icon {
      display: inline-flex;
      align-items: center;
    }
    .variant-icon svg {
      width: 14px;
      height: 14px;
    }

    .item-card {
      position: relative;
      width: 160px;
      padding: 1rem 0.75rem 0.75rem;
      background: linear-gradient(180deg,
        rgba(9, 20, 40, 0.9),
        rgba(1, 10, 19, 0.95));
      border: 1px solid var(--lol-gold-5);
      transition: all 0.25s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .item-card:hover {
      border-color: var(--lol-gold-3);
      transform: translateY(-3px);
      box-shadow:
        0 0 0 1px var(--lol-gold-4),
        0 8px 24px rgba(200, 155, 60, 0.2);
    }
    .step-badge {
      position: absolute;
      top: -10px;
      left: 50%;
      transform: translateX(-50%);
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: linear-gradient(180deg, var(--lol-gold-3), var(--lol-gold-4));
      color: var(--lol-void);
      font-family: 'Cinzel', serif;
      font-size: 0.8rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--lol-gold-2);
      box-shadow: 0 2px 8px rgba(200, 155, 60, 0.4);
    }
    .item-icon-wrap {
      position: relative;
      width: 56px;
      height: 56px;
      padding: 2px;
      background: linear-gradient(135deg, var(--lol-gold-3), var(--lol-gold-5));
      margin-bottom: 0.5rem;
    }
    .item-icon {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .item-card:hover .item-icon-wrap {
      box-shadow: 0 0 20px rgba(200, 155, 60, 0.5);
    }
    .item-name {
      font-family: 'Cinzel', serif;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--lol-gold-1);
      line-height: 1.2;
      margin-bottom: 0.25rem;
      min-height: 2rem;
    }
    .item-gold {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.7rem;
      color: var(--lol-gold-3);
      font-weight: 600;
    }
    .item-reasons {
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--lol-gold-5);
      width: 100%;
    }

    .build-arrow {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--lol-gold-3);
      opacity: 0.5;
      flex-shrink: 0;
    }

    .anomaly-banner {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.9rem 1.1rem;
      background: linear-gradient(90deg,
        rgba(200, 155, 60, 0.12) 0%,
        rgba(200, 155, 60, 0.04) 100%);
      border-left: 3px solid var(--lol-gold-3);
      border-right: 1px solid var(--lol-gold-5);
      border-top: 1px solid var(--lol-gold-5);
      border-bottom: 1px solid var(--lol-gold-5);
    }

    /* Rush component section — Tear etc. must be bought early despite the full
       item sitting later in the build order. Small horizontal row of cards,
       each with "component → final item" arrow so the player immediately grasps
       what they're pre-buying for. */
    .rush-section {
      padding: 0.9rem 1rem 1rem;
      background: linear-gradient(90deg,
        rgba(10, 200, 185, 0.08) 0%,
        rgba(200, 155, 60, 0.04) 100%);
      border: 1px solid var(--lol-gold-5);
      border-left: 3px solid var(--lol-cyan);
    }
    .rush-card {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: linear-gradient(180deg,
        rgba(9, 20, 40, 0.9),
        rgba(1, 10, 19, 0.95));
      border: 1px solid var(--lol-gold-5);
      min-width: 260px;
      max-width: 340px;
    }
    .rush-card-body {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .rush-icon-wrap {
      width: 44px;
      height: 44px;
      padding: 2px;
      background: linear-gradient(135deg, var(--lol-cyan), var(--lol-gold-4));
      box-shadow: 0 0 14px rgba(10, 200, 185, 0.35);
      flex-shrink: 0;
    }
    .rush-icon {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .rush-arrow {
      color: var(--lol-gold-3);
      opacity: 0.7;
      display: flex;
      align-items: center;
    }
    .rush-target-wrap {
      width: 36px;
      height: 36px;
      padding: 1px;
      background: linear-gradient(135deg, var(--lol-gold-4), var(--lol-gold-5));
      flex-shrink: 0;
      opacity: 0.85;
    }
    .rush-target {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .rush-card-text {
      line-height: 1.3;
    }
    .rush-title {
      font-size: 0.78rem;
    }
    .rush-reason {
      font-size: 0.68rem;
      color: var(--lol-text-muted);
      margin-top: 0.2rem;
      line-height: 1.35;
    }

    /* Skill order section — Q/W/E priority badges with arrows between them,
       matching the build order row's visual language (gold accents, Cinzel
       labels, dark abyss backdrop). Separated from items by a top border
       ornament so the transition reads as "and one more thing: skills". */
    .skill-section {
      padding-top: 1.25rem;
      border-top: 1px solid var(--lol-gold-5);
      position: relative;
    }
    .skill-section::before {
      content: '';
      position: absolute;
      top: -1px;
      left: 50%;
      transform: translateX(-50%);
      width: 80px;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--lol-gold-3), transparent);
    }

    /* 18-level grid — one cell per champion level, laid out as a compact row that
       wraps naturally on smaller screens. Each cell is small enough that all 18 fit
       on one line on desktop (9 per half = 80ish px each) and wraps to 2 rows of 9
       on narrow screens. */
    .skill-grid {
      display: grid;
      grid-template-columns: repeat(18, minmax(0, 1fr));
      gap: 0.35rem;
    }
    @media (max-width: 900px) {
      .skill-grid {
        grid-template-columns: repeat(9, minmax(0, 1fr));
      }
    }
    @media (max-width: 520px) {
      .skill-grid {
        grid-template-columns: repeat(6, minmax(0, 1fr));
      }
    }
    .skill-cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;
      padding: 0.35rem 0.2rem 0.4rem;
      background: linear-gradient(180deg,
        rgba(9, 20, 40, 0.9),
        rgba(1, 10, 19, 0.95));
      border: 1px solid var(--lol-gold-5);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .skill-cell:hover {
      transform: translateY(-2px);
      border-color: var(--lol-gold-4);
      box-shadow: 0 4px 12px rgba(200, 155, 60, 0.15);
    }
    .skill-cell-level {
      font-size: 0.6rem;
      font-family: 'Cinzel', serif;
      letter-spacing: 0.08em;
      color: var(--lol-text-muted);
      text-transform: uppercase;
    }
    .skill-cell-slot {
      font-family: 'Cinzel', serif;
      font-size: 1rem;
      font-weight: 700;
      color: var(--lol-gold-1);
      line-height: 1;
    }
    /* Primary-priority cells (the ability maxed first) — bright gold gradient + glow
       so the eye immediately picks out the backbone of the build. */
    .skill-cell-primary {
      background: linear-gradient(180deg,
        rgba(200, 155, 60, 0.35),
        rgba(120, 90, 40, 0.18));
      border-color: var(--lol-gold-3);
      box-shadow:
        0 0 0 1px var(--lol-gold-3),
        0 2px 10px rgba(200, 155, 60, 0.3);
    }
    /* Ultimate cells — cyan accent to visually separate R level-ups from basic-ability
       level-ups; matches the btn-gold-ghost cyan hover treatment used elsewhere. */
    .skill-cell-ult {
      background: linear-gradient(180deg,
        rgba(10, 200, 185, 0.25),
        rgba(0, 90, 130, 0.18));
      border-color: var(--lol-cyan);
      box-shadow: 0 0 10px rgba(10, 200, 185, 0.35);
    }
    .skill-cell-ult .skill-cell-slot {
      color: var(--lol-gold-1);
      text-shadow: 0 0 8px rgba(10, 200, 185, 0.6);
    }

  `],
})
export class BuildPanelComponent implements OnChanges {
  @Input() recommendation!: BuildRecommendation;
  @Input() version = '14.24.1';

  // TranslationService is used by resolveAnomalyArgs() to pre-localize lane
  // keys baked into backend-supplied anomaly args.
  private translation = inject(TranslationService);

  // Which of the three build variants is currently displayed. Defaults to 'standard'
  // and is reset whenever the panel receives a new champion recommendation.
  selectedStyle = signal<string>('standard');

  ngOnChanges(changes: SimpleChanges) {
    if (changes['recommendation'] && this.recommendation?.variants?.length) {
      const hasCurrent = this.recommendation.variants.some(v => v.style === this.selectedStyle());
      if (!hasCurrent) {
        this.selectedStyle.set(this.recommendation.variants[0].style);
      }
    }
  }

  currentVariant(): BuildVariant | undefined {
    return this.recommendation?.variants?.find(v => v.style === this.selectedStyle());
  }

  selectVariant(style: string) {
    this.selectedStyle.set(style);
  }

  totalGold(variant: BuildVariant): number {
    return variant.items.reduce((sum, r) => sum + (r.item.gold?.total ?? 0), 0);
  }

  /**
   * Prefers the backend-provided `imageUrl` (always correct for the current patch),
   * falls back to building the URL from `imageFileName + version` if the backend
   * didn't ship the field (older cached responses, dev hot-reload edge cases).
   */
  itemImageUrl(item: { imageUrl?: string; imageFileName: string }): string {
    if (item.imageUrl) return item.imageUrl;
    return `https://ddragon.leagueoflegends.com/cdn/${this.version}/img/item/${item.imageFileName}`;
  }

  /**
   * Full champion splash art URL used as hero background.
   * Data Dragon splash URLs use PascalCase keys without spaces/apostrophes.
   */
  splashUrl(): string {
    const name = this.recommendation?.championName;
    if (!name) return '';
    const key = name.replace(/[\s'.]/g, '');
    return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${key}_0.jpg`;
  }

  /**
   * Icon for each build variant tab — helps users immediately identify the style
   * without reading the label. Sword = aggressive, shield = defensive, scales = standard.
   */
  variantIcon(style: string): string {
    const svg = (path: string) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="${path}"/></svg>`;
    switch (style) {
      case 'aggressive':
        return svg('M6.92 5H5l9 9 1-.94L6.92 5zM19 13.41L11.59 6h3.29L19 10.12v3.29zM14.89 8.5L13.47 9.92l5.33 5.33V18h2v-3.59l-5.91-5.91z');
      case 'defensive':
        return svg('M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z');
      case 'standard':
      default:
        return svg('M12 3l-1 1v3.17l-1.6.46-1.82-1.82-1.4 1.4 1.82 1.82L7.55 10H3v2h4.55l.44 1.03-1.82 1.82 1.4 1.4 1.82-1.82L11 15V21h1 1v-6l1.6-.58 1.82 1.82 1.4-1.4-1.82-1.82L16.55 12H21v-2h-4.55l-.44-1.03 1.82-1.82-1.4-1.4-1.82 1.82L13 7.17V4l-1-1z');
    }
  }

  onImgError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  /**
   * Pre-resolves translation keys inside anomaly args before they hit the outer
   * `| t` pipe. Backend sends lane values as bare translation keys like
   * "lane.top", which the t pipe alone can't substitute into `{requestedLane}`
   * because the pipe only replaces placeholders with their raw arg values.
   *
   * This helper walks the args dict, translates any `lane.*` strings through
   * the active language, then returns a new dict with the resolved labels.
   * The outer pipe call on the anomaly key then substitutes those already-
   * localized strings into `{requestedLane}` / `{naturalLane}` slots.
   */
  resolveAnomalyArgs(args?: Record<string, string | number> | null): Record<string, string | number> | null {
    if (!args) return null;
    const resolved: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string' && value.startsWith('lane.')) {
        resolved[key] = this.translation.t(value as TranslationKey);
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }

  /**
   * True when the slot is the ability that gets maxed FIRST (priority[0]). Used to
   * highlight those cells in the level grid with the bright-gold "primary" style so
   * the player can see at a glance which basic is the top priority.
   */
  isMaxFirstSlot(skills: { priority: string[] }, slot: string): boolean {
    return slot !== 'R' && skills.priority?.[0] === slot;
  }
}
