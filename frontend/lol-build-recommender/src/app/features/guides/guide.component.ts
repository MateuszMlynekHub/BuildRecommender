import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';

interface Guide {
  slug: string;
  title: string;
  description: string;
  content: string[];
}

const GUIDES: Guide[] = [
  {
    slug: 'counter-building-101',
    title: 'Counter Building 101 — How to Build Against the Enemy Team in LoL',
    description: 'Learn how to counter-build in League of Legends. Anti-heal items, tenacity, armor, MR — when to buy what based on enemy team composition.',
    content: [
      'Counter-building is the most impactful skill gap between low and high elo players. Instead of following the same build every game, adapting your itemization to the enemy team composition can swing your win rate by 5-10%.',
      'The first step is identifying the enemy team\'s primary threat: Is it physical damage (AD) or magic damage (AP)? Count the damage sources — if 3+ enemies deal physical damage, prioritize armor. If the enemy has a fed AP carry, rush Magic Resist.',
      'Anti-heal (Grievous Wounds) is the most commonly missed counter-build. If the enemy has champions like Soraka, Yuumi, Aatrox, or Vladimir — healing-heavy champions — you NEED anti-heal items early. Executioner\'s Calling (800g), Oblivion Orb (800g), or Bramble Vest (800g) are cheap and effective.',
      'Tenacity reduces crowd control duration. Against CC-heavy teams (Leona, Amumu, Morgana), Mercury\'s Treads + Legend: Tenacity rune can reduce CC by up to 51%. This is often more valuable than raw damage stats.',
      'Armor penetration vs Armor: if the enemy team has 2+ tanks stacking armor, you need Last Whisper items (Lord Dominik\'s Regards, Mortal Reminder). If they have no tanks, flat lethality (Youmuu\'s, Edge of Night) is more effective against squishy targets.',
      'DraftSense automates this analysis — enter your Riot ID during an active game, and the system analyzes the enemy team composition to recommend the optimal counter-build for your champion and role.',
    ],
  },
  {
    slug: 'anti-heal-items',
    title: 'When to Buy Anti-Heal Items in LoL — Complete Guide',
    description: 'Complete guide to Grievous Wounds items in League of Legends. Learn when to buy anti-heal, which item to choose, and how healing reduction works.',
    content: [
      'Grievous Wounds (GW) reduces all healing received by the target. In the current meta, healing is everywhere — from champion kits to runes to items. Knowing when to buy anti-heal is crucial.',
      'Buy anti-heal EARLY when the enemy team has: dedicated healers (Soraka, Yuumi, Sona), drain tanks (Aatrox, Vladimir, Warwick, Sylas), or champions with built-in sustain (Fiora, Irelia, Yasuo with lifesteal).',
      'AD champions should buy Executioner\'s Calling (800g) → upgrade to Mortal Reminder later. AP champions should buy Oblivion Orb (800g) → upgrade to Morello\'s. Tanks should buy Bramble Vest (800g) → upgrade to Thornmail.',
      'Don\'t buy anti-heal against teams with minimal healing. If the enemy has no healing champions and no lifesteal itemizers, your gold is better spent on damage or defensive stats.',
      'Timing matters: buying anti-heal at 5 minutes against a Soraka is game-changing. Buying it at 30 minutes is too late — by then, the healer has already won multiple fights for their team.',
      'Use DraftSense to automatically detect healing threats. The system calculates a "Healing Threat" score for the enemy team and recommends anti-heal items when the score exceeds the threshold.',
    ],
  },
  {
    slug: 'tenacity-items',
    title: 'Tenacity Items in LoL — When and Why to Buy Them',
    description: 'Guide to tenacity in League of Legends. Mercury\'s Treads, Legend: Tenacity, and Unflinching — how to stack tenacity against CC-heavy teams.',
    content: [
      'Tenacity reduces the duration of crowd control effects (stuns, roots, slows, fears). Against CC-heavy enemy teams, stacking tenacity can be the difference between being locked down for 3 seconds or escaping in 1.5.',
      'Mercury\'s Treads provide 30% tenacity. This is the single most impactful tenacity purchase and should be your default boots choice against teams with 2+ hard CC abilities.',
      'Legend: Tenacity rune provides up to 18% tenacity when fully stacked. Combined with Mercury\'s Treads (30%), you reach 42.6% tenacity — nearly halving CC duration.',
      'Unflinching (Resolve tree) grants 10-30% tenacity based on missing health. This is particularly strong on bruisers and tanks who fight at low health.',
      'Tenacity does NOT reduce knockups or suppressions. Against Malzahar, Yasuo, or Cho\'Gath knockup, tenacity won\'t help — you need Quicksilver Sash (QSS) for suppressions, and positioning for knockups.',
      'DraftSense\'s CC Threat analysis automatically detects when the enemy team has enough crowd control to warrant tenacity purchases and recommends Mercury\'s Treads or Legend: Tenacity accordingly.',
    ],
  },
];

@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="guide-page">
      <div class="guide-container">
        <a routerLink="/champions" class="guide-back">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Back to Champions
        </a>

        @if (guide) {
          <h1 class="guide-title">{{ guide.title }}</h1>
          <div class="guide-content">
            @for (para of guide.content; track $index) {
              <p>{{ para }}</p>
            }
          </div>
        } @else {
          <!-- Guide index -->
          <h1 class="guide-title">LoL Guides</h1>
          <div class="guide-list">
            @for (g of guides; track g.slug) {
              <a class="guide-card" [routerLink]="['/guide', g.slug]">
                <h2 class="guide-card__title">{{ g.title }}</h2>
                <p class="guide-card__desc">{{ g.description }}</p>
              </a>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .guide-page { min-height: 100vh; padding: 2rem 1rem 3rem; }
    .guide-container { max-width: 760px; margin: 0 auto; }

    .guide-back {
      display: inline-flex; align-items: center; gap: 0.3rem;
      color: var(--lol-gold-4); text-decoration: none; font-size: 0.75rem;
      margin-bottom: 1.5rem; transition: color 0.15s;
    }
    .guide-back:hover { color: var(--lol-gold-2); }

    .guide-title {
      font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 3.5vw, 2rem);
      color: var(--lol-gold-1); letter-spacing: 0.03em; margin-bottom: 1.5rem;
      line-height: 1.3;
    }

    .guide-content p {
      font-size: 0.88rem; line-height: 1.75; color: var(--lol-gold-1);
      margin-bottom: 1.25rem;
    }

    .guide-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .guide-card {
      padding: 1rem; background: rgba(1,10,19,0.55); border: 1px solid var(--lol-gold-5);
      border-radius: 2px; text-decoration: none; transition: all 0.15s;
    }
    .guide-card:hover { border-color: var(--lol-gold-4); background: rgba(200,155,60,0.06); }
    .guide-card__title { font-size: 0.92rem; font-weight: 600; color: var(--lol-gold-1); margin-bottom: 0.3rem; }
    .guide-card__desc { font-size: 0.78rem; color: var(--lol-text-muted); line-height: 1.4; }
  `],
})
export class GuideComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private seo = inject(SeoService);

  readonly guides = GUIDES;
  guide: Guide | undefined;

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    this.guide = slug ? GUIDES.find(g => g.slug === slug) : undefined;

    if (this.guide) {
      this.seo.updatePageMeta({
        title: this.guide.title + ' | DraftSense',
        description: this.guide.description,
        url: `https://draftsense.net/guide/${this.guide.slug}`,
      });
    } else {
      this.seo.updatePageMeta({
        title: 'LoL Guides — Counter Building, Anti-Heal, Tenacity | DraftSense',
        description: 'Free League of Legends guides. Learn counter-building, when to buy anti-heal, tenacity stacking, and more.',
        url: 'https://draftsense.net/guide',
      });
    }
  }
}
