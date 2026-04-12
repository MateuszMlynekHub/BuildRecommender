// ============================================================================
// DraftSense — translation dictionary
// ============================================================================
// Flat-key translations for all user-facing UI strings. This file is the
// single source of truth; when a new string is added to a template via the
// `t` pipe, add an entry here for every supported language.
//
// Conventions:
//   • Keys use dot.namespace.case ('home.hero.title', 'footer.coffee.cta')
//   • ALL languages have ALL keys — no silent fallbacks. The `Dict = Readonly
//     <Record<TranslationKey, string>>` type makes missing keys a compile
//     error so we can't forget a translation.
//   • Translations were produced by a single developer using reference
//     dictionaries and native-speaker review where possible. DE/ES/RU/UK
//     should be sanity-checked by a native speaker before launch.
//   • Backend-generated strings (reason tags, anomaly notes, early-component
//     reasons, variant descriptions) are NOT in this file — they come from
//     BuildRecommenderService.cs in Polish. Full backend i18n requires the
//     backend to return translation keys instead of raw strings, tracked as
//     a v2 task.
// ============================================================================

/** BCP 47 language codes. `uk` = Ukrainian (not UK!); displayed as "UA" in UI. */
export type Lang = 'pl' | 'en' | 'de' | 'es' | 'ru' | 'uk';

/** Order defines the display order in the language switcher. */
export const SUPPORTED_LANGS: readonly Lang[] = ['pl', 'en', 'de', 'es', 'ru', 'uk'] as const;

/** Display metadata for each language — used by the switcher component. */
export interface LangMeta {
  /** Endonym (how the language calls itself) — shown in tooltip. */
  readonly label: string;
  /** 2-letter uppercase code shown as button text (no emoji flags). */
  readonly code: string;
}

export const LANG_META: Record<Lang, LangMeta> = {
  pl: { label: 'Polski',       code: 'PL' },
  en: { label: 'English',      code: 'EN' },
  de: { label: 'Deutsch',      code: 'DE' },
  es: { label: 'Español',      code: 'ES' },
  ru: { label: 'Русский',      code: 'RU' },
  // UA is the country code users recognize; BCP47 "uk" = Ukrainian language
  // (NOT British English — British English is "en-GB"). Keep the locale key
  // as "uk" per standard and display "UA" to avoid user confusion.
  uk: { label: 'Українська',   code: 'UA' },
};

/**
 * All translation keys. Keep this union synced with every Dict below —
 * TypeScript will flag any dict missing a key so drift is caught at compile
 * time rather than blowing up at runtime with a blank label.
 */
export type TranslationKey =
  // ---- Language switcher ------------------------------------------------
  | 'lang.label'

  // ---- Top navigation ----------------------------------------------------
  | 'nav.ariaLabel'
  | 'nav.searchGame'
  | 'nav.teamShuffle'
  | 'nav.champions'

  // ---- Footer ------------------------------------------------------------
  | 'footer.coffee.cta'
  | 'footer.coffee.button'
  | 'footer.cookies'

  // ---- Cookie consent banner ---------------------------------------------
  | 'cookie.banner.message'
  | 'cookie.banner.accept'
  | 'cookie.banner.reject'

  // ---- Team Shuffle ------------------------------------------------------
  | 'shuffle.title'
  | 'shuffle.subtitle'
  | 'shuffle.addPlayer'
  | 'shuffle.removePlayer'
  | 'shuffle.shuffleButton'
  | 'shuffle.shuffling'
  | 'shuffle.shuffleAgain'
  | 'shuffle.deciding'
  | 'shuffle.options.randomChampions'
  | 'shuffle.options.randomRoles'
  | 'shuffle.options.roleAppropriate'
  | 'shuffle.needMorePlayers'
  | 'shuffle.blueTeam'
  | 'shuffle.redTeam'

  // ---- Champions list ----------------------------------------------------
  | 'champions.title'
  | 'champions.subtitle'
  | 'champions.search'
  | 'champions.allRoles'
  | 'champions.noResults'
  | 'champion.builds'
  | 'champion.abilities'
  | 'champion.passive'
  | 'champion.stats'
  | 'champion.lore'
  | 'champion.tips.ally'
  | 'champion.tips.enemy'
  | 'champion.skillOrder'
  | 'champion.popularItems'
  | 'champion.winRate'
  | 'champion.pickRate'
  | 'champion.cooldown'
  | 'champion.cost'
  | 'champion.range'

  // ---- Home hero ---------------------------------------------------------
  | 'home.hero.title1'
  | 'home.hero.title2'
  | 'home.hero.subtitle'
  | 'home.hero.footerHint'

  // ---- Home search form -------------------------------------------------
  | 'home.form.riotId'
  | 'home.form.riotId.name.placeholder'
  | 'home.form.riotId.tag.placeholder'
  | 'home.form.region'
  | 'home.form.submit'
  | 'home.form.submit.loading'
  | 'home.form.error.emptyFields'
  | 'home.form.error.notInGame'
  | 'home.form.error.apiKey'
  | 'home.form.error.generic'

  // ---- Home SEO content section -----------------------------------------
  | 'home.seo.h2.features'
  | 'home.seo.features.p1'
  | 'home.seo.h3.counterBuild'
  | 'home.seo.counterBuild.p1'
  | 'home.seo.h3.rolesChampions'
  | 'home.seo.rolesChampions.p1'
  | 'home.seo.h3.metaBuilds'
  | 'home.seo.metaBuilds.p1'
  | 'home.seo.h3.adaptive'
  | 'home.seo.adaptive.p1'
  | 'home.seo.disclaimer'

  // ---- Game view (live match) -------------------------------------------
  | 'game.live'
  | 'game.title'
  | 'game.back'
  | 'game.backToSearch'
  | 'game.loading'
  | 'game.forging'
  | 'game.noGame'
  | 'game.bans'
  | 'game.noBans'
  | 'game.blueTeam'
  | 'game.redTeam'
  | 'game.players'
  | 'game.you'
  | 'game.unknown'
  | 'game.vs'
  | 'game.dragHint'
  | 'game.selectChampion'

  // ---- Lane labels -------------------------------------------------------
  | 'lane.top'
  | 'lane.jungle'
  | 'lane.middle'
  | 'lane.bottom'
  | 'lane.utility'
  | 'lane.unknown'

  // ---- Build panel — threat profile -------------------------------------
  | 'build.threatProfile.title'
  | 'build.threatProfile.subtitle'

  | 'build.threat.ad'
  | 'build.threat.ap'
  | 'build.threat.heal'
  | 'build.threat.cc'
  | 'build.threat.tank'
  | 'build.threat.shield'
  | 'build.threat.engage'
  | 'build.threat.poke'
  | 'build.threat.trueDmg'

  | 'build.chip.critCarry'
  | 'build.chip.invisible'

  // ---- Build panel — variant tabs ---------------------------------------
  | 'build.variant.standard'
  | 'build.variant.standard.description'
  | 'build.variant.aggressive'
  | 'build.variant.aggressive.description'
  | 'build.variant.defensive'
  | 'build.variant.defensive.description'

  // ---- Build panel — off-meta banner ------------------------------------
  | 'build.anomaly.title'

  // ---- Build panel — rush components ------------------------------------
  | 'build.rush.title'

  // ---- Build panel — build order ----------------------------------------
  | 'build.order.title'
  | 'build.order.totalCost'

  // ---- Build panel — skill order ----------------------------------------
  | 'build.skillOrder.title'
  | 'build.skillOrder.ariaLabel'

  // ---- Anomaly notes (from backend) -------------------------------------
  // Placeholders: {champion}, {requestedLane}, {naturalLane}
  | 'anomaly.offMeta'
  | 'anomaly.noData'

  // ---- Early component rush reason --------------------------------------
  // Placeholders: {item}
  | 'earlyComponent.tearRush'

  // ---- Item reasons (from backend per-item bullets) --------------------
  // Naming: reason.<conciseWhat>. Placeholders documented inline per language
  // but are uniform across all locales.
  | 'reason.armorVsAd'              // {percent}
  | 'reason.mrVsAp'                 // {percent}
  | 'reason.gwVsHealing'
  | 'reason.gwVsShields'            // {percent}
  | 'reason.gwAllyCovered'
  | 'reason.randuinVsCrit'
  | 'reason.resistVsTrue'           // {percent}
  | 'reason.hpScalesWithTrue'       // {penalty}
  | 'reason.armorPenCount'          // {count}
  | 'reason.magicPenCount'          // {count}
  | 'reason.armorPen'
  | 'reason.magicPen'
  | 'reason.hpVsAssassins'          // {count}
  | 'reason.defVsBurst'             // {count}
  | 'reason.tenacity'               // {percent}
  | 'reason.antiEngage'             // {percent}
  | 'reason.antiPoke'               // {percent}
  | 'reason.proMeta'                // {champion} {rank} {total}
  | 'reason.goodItem'               // {champion}
  | 'reason.synergy.ardentFriendly' // {ally}
  | 'reason.synergy.ardentUnfriendly' // {ally}
  | 'reason.synergy.flowingWaterMediocre'; // {ally}

type Dict = Readonly<Record<TranslationKey, string>>;

// ----------------------------------------------------------------------------
// POLSKI — primary language, written natively
// ----------------------------------------------------------------------------
const pl: Dict = {
  'lang.label': 'Język',

  'nav.ariaLabel':  'Nawigacja główna',
  'nav.searchGame': 'Szukaj gry',
  'nav.teamShuffle': 'Losuj drużyny',
  'nav.champions': 'Bohaterowie',

  'footer.coffee.cta':    'Podoba ci się narzędzie? Postaw kawę —',
  'footer.coffee.button': 'Buy me a coffee',
  'footer.cookies':       'Cookies',

  'cookie.banner.message': 'Używamy plików cookies Google Analytics, żeby mierzyć ruch i ulepszać aplikację. Twoje dane nie trafiają do nikogo poza GA. Wybierz, czy się zgadzasz — możesz zmienić zdanie w dowolnym momencie.',
  'cookie.banner.accept':  'Akceptuję',
  'cookie.banner.reject':  'Odrzuć',

  'shuffle.title':                     'Losowanie drużyn',
  'shuffle.subtitle':                  'Wpisz graczy, kliknij losuj, zagraj custom bez kłótni o kto z kim',
  'shuffle.addPlayer':                 'Dodaj gracza',
  'shuffle.removePlayer':              'Usuń gracza',
  'shuffle.shuffleButton':             'Losuj drużyny',
  'shuffle.shuffling':                 'Losuję...',
  'shuffle.shuffleAgain':              'Losuj jeszcze raz',
  'shuffle.deciding':                  'Losuję przeznaczenia...',
  'shuffle.options.randomChampions':   'Losowe postacie',
  'shuffle.options.randomRoles':       'Losowe role',
  'shuffle.options.roleAppropriate':   'Postacie dopasowane do roli',
  'shuffle.needMorePlayers':           'Potrzebujesz minimum 2 graczy, żeby zacząć',
  'shuffle.blueTeam':                  'Niebieska drużyna',
  'shuffle.redTeam':                   'Czerwona drużyna',

  'champions.title':                   'Bohaterowie',
  'champions.subtitle':                'Przeglądaj wszystkich bohaterów League of Legends',
  'champions.search':                  'Szukaj bohatera...',
  'champions.allRoles':                'Wszystkie',
  'champions.noResults':               'Nie znaleziono bohaterów',
  'champion.builds':                   'Buildy',
  'champion.abilities':                'Umiejętności',
  'champion.passive':                  'Pasywna',
  'champion.stats':                    'Statystyki',
  'champion.lore':                     'Historia',
  'champion.tips.ally':                'Wskazówki',
  'champion.tips.enemy':               'Jak grać przeciw',
  'champion.skillOrder':               'Kolejność umiejętności',
  'champion.popularItems':             'Popularne przedmioty',
  'champion.winRate':                  'Wygrane',
  'champion.pickRate':                 'Wybieralność',
  'champion.cooldown':                 'Czas odnowienia',
  'champion.cost':                     'Koszt',
  'champion.range':                    'Zasięg',

  'home.hero.title1':      'DRAFT',
  'home.hero.title2':      'SENSE',
  'home.hero.subtitle':    'Sprytne buildy dopasowane do twojej gry',
  'home.hero.footerHint':  'Napędzane przez Riot API · Pro meta z Challenger + Grandmaster',

  'home.form.riotId':                     'Riot ID',
  'home.form.riotId.name.placeholder':    'Nick',
  'home.form.riotId.tag.placeholder':     'Tag',
  'home.form.region':                     'Serwer',
  'home.form.submit':                     'Znajdź aktywną grę',
  'home.form.submit.loading':             'Szukam...',
  'home.form.error.emptyFields':          'Wpisz swoje Riot ID (Nick#TAG).',
  'home.form.error.notInGame':            'Gracza nie ma w aktywnej grze lub nie został znaleziony.',
  'home.form.error.apiKey':               'Nieprawidłowy lub brakujący klucz Riot API. Sprawdź konfigurację backendu.',
  'home.form.error.generic':              'Coś poszło nie tak. Spróbuj ponownie.',

  'home.seo.h2.features':           'Sprytne buildy LoL dopasowane do twojej gry',
  'home.seo.features.p1':           'Każda gra w League of Legends jest inna. Raz wróg stackuje leczenie i nic nie umiera, innym razem wskakuje na ciebie i znosi w dwie sekundy, a czasem po prostu wybija cię z lany zanim zdążysz dobić minionów. DraftSense sprawdza twoją aktywną grę w momencie gdy ją uruchamiasz i pokazuje, co dokładnie kupić, żeby poradzić sobie z tym, co robi druga drużyna. Koniec z kupowaniem tych samych trzech itemów z przyzwyczajenia — każda gra dostaje build, który naprawdę pasuje.',
  'home.seo.h3.counterBuild':       'Odpowiednie itemy przeciwko odpowiednim wrogom',
  'home.seo.counterBuild.p1':       'Item defensywny, którego nie potrzebujesz, to zmarnowany slot. DraftSense najpierw patrzy, kto gra po drugiej stronie i dopiero wtedy wybiera countery — redukcję leczenia gdy wróg naprawdę się leczy, odporność magiczną przy burstowych magach, itemy przeżywalności kiedy przeciwnicy wskakują na ciebie co dwadzieścia sekund. Jeśli wroga drużyna bardziej tarczuje niż leczy, nie będziemy cię pchać do anti-healu, który i tak nic tu nie zrobi.',
  'home.seo.h3.rolesChampions':     'Buildy dopasowane do twojej roli',
  'home.seo.rolesChampions.p1':     'ADC potrzebuje czegoś zupełnie innego niż support, a mid mage czegoś innego niż top bruiser. DraftSense rozumie tę różnicę. Niezależnie od tego czy mainowujesz Zeda na środku, grasz Jinx na bocie, flexujesz Ahri czy lockujesz Thresha na supporcie — rekomendacje pasują do twojej pozycji i tego, czego drużyna od ciebie potrzebuje. Każdy champion w każdej roli dostaje build, który ma sens dla tego, jak się nim faktycznie gra.',
  'home.seo.h3.metaBuilds':         'Odświeżane z każdym patchem',
  'home.seo.metaBuilds.p1':         'Meta LoLa zmienia się cały czas. Build, który carry\'ował w zeszłym tygodniu, po nowym patchu potrafi być zupełnie nie do grania. DraftSense ściąga aktualne buildy bezpośrednio od najlepszych graczy — z Challengera, Grandmastera i Mastera — i odświeża je z każdym patchem Riota. Zawsze widzisz to, co najlepsi gracze w twoim regionie faktycznie kupują teraz, a nie stary guide sprzed dwóch sezonów.',
  'home.seo.h3.adaptive':           'Trzy buildy — ty wybierasz',
  'home.seo.adaptive.p1':           'Niektóre mecze wołają o pełny all-in, inne o przetrwanie do late game\'u. Każdy champion w DraftSense ma trzy gotowe warianty — Standardowy, Agresywny i Defensywny — wszystkie dopasowane do tej konkretnej drużyny wroga, którą właśnie masz. Chcesz iść do gardła? Agresywny daje maksimum obrażeń. Dostajesz dive od tankowego junglera? Defensywny rushuje przeżywalność. Nie masz pewności? Standardowy gra bezpiecznie. Jeden klik, widzisz wszystkie trzy, wybierasz ten który czujesz.',
  'home.seo.disclaimer':            'DraftSense nie jest powiązane z Riot Games i nie odzwierciedla poglądów ani opinii Riot Games ani nikogo oficjalnie związanego z produkcją czy zarządzaniem League of Legends.',

  'game.live':            'Live Match',
  'game.title':           'Summoner\'s Rift',
  'game.back':            'Wstecz',
  'game.backToSearch':    'Wróć do wyszukiwania',
  'game.loading':         'Ładowanie meczu...',
  'game.forging':         'Kuję build...',
  'game.noGame':          'Brak danych meczu. Wróć i wyszukaj grę.',
  'game.bans':            'Bany',
  'game.noBans':          'Brak banów',
  'game.blueTeam':        'Niebieska drużyna',
  'game.redTeam':         'Czerwona drużyna',
  'game.players':         'graczy',
  'game.you':             'TY',
  'game.unknown':         'Nieznany',
  'game.vs':              'VS',
  'game.dragHint':        'Przeciągnij, aby zamienić linię z innym graczem w tej drużynie',
  'game.selectChampion':  'Wybierz championa, aby wykuć jego build',

  'lane.top':      'Top',
  'lane.jungle':   'Jungle',
  'lane.middle':   'Mid',
  'lane.bottom':   'Bot',
  'lane.utility':  'Support',
  'lane.unknown':  '—',

  'build.threatProfile.title':    'Profil drużyny przeciwnej',
  'build.threatProfile.subtitle': 'zagrożenia do kontry',

  'build.threat.ad':       'AD',
  'build.threat.ap':       'AP',
  'build.threat.heal':     'Heal',
  'build.threat.cc':       'CC',
  'build.threat.tank':     'Tank',
  'build.threat.shield':   'Tarcze',
  'build.threat.engage':   'Engage',
  'build.threat.poke':     'Poke',
  'build.threat.trueDmg':  '%HP/True',

  'build.chip.critCarry':  'Crit ADC — Randuin\'s wartościowy',
  'build.chip.invisible':  'Niewidzialny przeciwnik — kup Control Wards / Oracle Lens',

  'build.variant.standard':               'Standardowy',
  'build.variant.standard.description':   'Zbalansowany build oparty na meta i bieżących zagrożeniach przeciwnika.',
  'build.variant.aggressive':             'Agresywny',
  'build.variant.aggressive.description': 'Więcej obrażeń (AD/AP/penetracja), mniej defensywy — szybsze zabicia kosztem przeżycia.',
  'build.variant.defensive':              'Defensywny',
  'build.variant.defensive.description':  'Wyższa przeżywalność (HP/Armor/MR), mniej damage\'u — dla trudnych matchupów.',

  'build.anomaly.title':  'Wykryto champion off-meta',

  'build.rush.title':     'Kup jako pierwsze — komponenty',

  'build.order.title':     'Kolejność kupna',
  'build.order.totalCost': 'Łączny koszt:',

  'build.skillOrder.title':     'Kolejność umiejętności',
  'build.skillOrder.ariaLabel': 'Kolejność umiejętności wg poziomu',

  'anomaly.offMeta':  '{champion} nietypowy ({requestedLane}) — wyświetlam meta ({naturalLane})',
  'anomaly.noData':   'Brak danych historycznych dla {champion} ({requestedLane}) — użyto scoringu archetype\'owego',

  'earlyComponent.tearRush': 'Kup jako pierwsze — pasywka stackuje się z czasem, im wcześniej kupisz Łzę tym mocniejsze będzie {item}.',

  'reason.armorVsAd':                     'Armor vs drużyna AD ({percent}%)',
  'reason.mrVsAp':                        'MR vs drużyna AP ({percent}%)',
  'reason.gwVsHealing':                   'Grievous Wounds vs healing przeciwnika',
  'reason.gwVsShields':                   'Grievous Wounds (obniżony priorytet — drużyna tarczuje {percent}%)',
  'reason.gwAllyCovered':                 'Grievous Wounds (sojusznik już pokrywa — obniżony priorytet)',
  'reason.randuinVsCrit':                 'Randuin\'s vs crit ADC',
  'reason.resistVsTrue':                  'Odporność > HP ({percent}% true/%HP dmg)',
  'reason.hpScalesWithTrue':              'HP skaluje z %HP przeciwnika (−{penalty})',
  'reason.armorPenCount':                 'Armor Pen vs {count} tanków',
  'reason.magicPenCount':                 'Magic Pen vs {count} tanków',
  'reason.armorPen':                      'Armor Penetration vs tanki',
  'reason.magicPen':                      'Magic Penetration vs tanki',
  'reason.hpVsAssassins':                 'HP vs {count} asasynów',
  'reason.defVsBurst':                    'Defensywa vs burst ({count} championów)',
  'reason.tenacity':                      'Tenacity vs engage CC ({percent}%)',
  'reason.antiEngage':                    'Anty-engage vs dive ({percent}%)',
  'reason.antiPoke':                      'Anty-poke sustain ({percent}%)',
  'reason.proMeta':                       'Pro meta {champion} ({rank}/{total})',
  'reason.goodItem':                      'Dobry item dla {champion}',
  'reason.synergy.ardentFriendly':        'Synergia z {ally} (AS carry)',
  'reason.synergy.ardentUnfriendly':      'Słabe z {ally} (brak skalowania AS)',
  'reason.synergy.flowingWaterMediocre':  'Średnie z {ally}',
};

// ----------------------------------------------------------------------------
// ENGLISH — written natively, primary international locale
// ----------------------------------------------------------------------------
const en: Dict = {
  'lang.label': 'Language',

  'nav.ariaLabel':  'Main navigation',
  'nav.searchGame': 'Search Game',
  'nav.teamShuffle': 'Team Shuffle',
  'nav.champions': 'Champions',

  'footer.coffee.cta':    'Enjoying the tool? Buy me a coffee —',
  'footer.coffee.button': 'Buy me a coffee',
  'footer.cookies':       'Cookies',

  'cookie.banner.message': 'We use Google Analytics cookies to measure traffic and improve the app. Your data isn\'t shared with anyone besides GA. Choose whether you consent — you can change your mind at any time.',
  'cookie.banner.accept':  'Accept',
  'cookie.banner.reject':  'Reject',

  'shuffle.title':                     'Team Shuffle',
  'shuffle.subtitle':                  'Enter the players, hit shuffle, play your custom game without arguing over who plays with whom',
  'shuffle.addPlayer':                 'Add player',
  'shuffle.removePlayer':              'Remove player',
  'shuffle.shuffleButton':             'Shuffle teams',
  'shuffle.shuffling':                 'Shuffling...',
  'shuffle.shuffleAgain':              'Shuffle again',
  'shuffle.deciding':                  'Rolling fates...',
  'shuffle.options.randomChampions':   'Random champions',
  'shuffle.options.randomRoles':       'Random roles',
  'shuffle.options.roleAppropriate':   'Role-appropriate champions',
  'shuffle.needMorePlayers':           'Enter at least 2 player names to start',
  'shuffle.blueTeam':                  'Blue Team',
  'shuffle.redTeam':                   'Red Team',

  'champions.title':                   'Champions',
  'champions.subtitle':                'Browse all League of Legends champions',
  'champions.search':                  'Search champion...',
  'champions.allRoles':                'All',
  'champions.noResults':               'No champions found',
  'champion.builds':                   'Builds',
  'champion.abilities':                'Abilities',
  'champion.passive':                  'Passive',
  'champion.stats':                    'Stats',
  'champion.lore':                     'Lore',
  'champion.tips.ally':                'Tips',
  'champion.tips.enemy':               'Playing against',
  'champion.skillOrder':               'Skill order',
  'champion.popularItems':             'Popular items',
  'champion.winRate':                  'Win rate',
  'champion.pickRate':                 'Pick rate',
  'champion.cooldown':                 'Cooldown',
  'champion.cost':                     'Cost',
  'champion.range':                    'Range',

  'home.hero.title1':      'DRAFT',
  'home.hero.title2':      'SENSE',
  'home.hero.subtitle':    'Smart builds that fit your actual game',
  'home.hero.footerHint':  'Powered by Riot API · Pro meta from Challenger + Grandmaster',

  'home.form.riotId':                     'Riot ID',
  'home.form.riotId.name.placeholder':    'Name',
  'home.form.riotId.tag.placeholder':     'Tag',
  'home.form.region':                     'Region',
  'home.form.submit':                     'Find active game',
  'home.form.submit.loading':             'Searching...',
  'home.form.error.emptyFields':          'Please enter your Riot ID (Name#TAG).',
  'home.form.error.notInGame':            'Player is not currently in a game, or summoner not found.',
  'home.form.error.apiKey':               'Invalid or missing Riot API key. Check backend configuration.',
  'home.form.error.generic':              'An error occurred. Please try again.',

  'home.seo.h2.features':           'Smart LoL builds that fit your actual game',
  'home.seo.features.p1':           'Every League of Legends match is different. Sometimes the enemy team stacks healing and nothing dies, sometimes they jump on you and delete you in two seconds, sometimes they just poke you out of lane before you can even farm. DraftSense checks your active game the moment you load in and shows you exactly what to buy to handle whatever\'s on the other side. No more buying the same three items out of habit — every game gets a build that actually fits.',
  'home.seo.h3.counterBuild':       'The right items against the right enemies',
  'home.seo.counterBuild.p1':       'A defensive item you don\'t need is a wasted slot. DraftSense looks at who\'s on the enemy team first and only then picks the counters — healing reduction when they actually heal, magic resist when there\'s a burst mage nearby, survival items when they jump on you every twenty seconds. If the enemy team shields more than it heals, we won\'t push you toward anti-heal that wouldn\'t do anything here.',
  'home.seo.h3.rolesChampions':     'Builds tuned to your role',
  'home.seo.rolesChampions.p1':     'An ADC needs something completely different from a support, a mid mage something different from a top bruiser. DraftSense gets this. Whether you\'re maining Zed mid, playing Jinx bot, flexing Ahri around the map, or locking in Thresh support — the recommendations match your position and what your team actually needs from you. Every champion in every role gets a build that makes sense for how they\'re actually played.',
  'home.seo.h3.metaBuilds':         'Updated with every patch',
  'home.seo.metaBuilds.p1':         'The LoL meta shifts constantly. A build that carried last week can be completely unplayable after the next patch. DraftSense pulls current builds straight from the best players — Challenger, Grandmaster, and Master tier — and refreshes them with every Riot patch. You\'re always seeing what the top players in your region are actually buying right now, not a guide from two seasons ago.',
  'home.seo.h3.adaptive':           'Three builds, you pick',
  'home.seo.adaptive.p1':           'Some matches call for a full all-in, others for pure late-game scaling. Every champion in DraftSense ships with three ready-made variants — Standard, Aggressive, and Defensive — all tailored to the specific enemy team you\'re facing right now. Want to go for the throat? Aggressive maxes damage. Getting dove by the tank jungler? Defensive rushes survival. Not sure? Standard plays it safe. One click, see all three, pick the one that feels right.',
  'home.seo.disclaimer':            'DraftSense isn\'t endorsed by Riot Games and doesn\'t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing League of Legends.',

  'game.live':            'Live Match',
  'game.title':           'Summoner\'s Rift',
  'game.back':            'Back',
  'game.backToSearch':    'Back to search',
  'game.loading':         'Loading match...',
  'game.forging':         'Forging build...',
  'game.noGame':          'No game data. Go back and search for a game.',
  'game.bans':            'Bans',
  'game.noBans':          'No bans',
  'game.blueTeam':        'Blue Team',
  'game.redTeam':         'Red Team',
  'game.players':         'players',
  'game.you':             'YOU',
  'game.unknown':         'Unknown',
  'game.vs':              'VS',
  'game.dragHint':        'Drag to swap lane with another player on this team',
  'game.selectChampion':  'Select a champion to forge their build',

  'lane.top':      'Top',
  'lane.jungle':   'Jungle',
  'lane.middle':   'Mid',
  'lane.bottom':   'Bot',
  'lane.utility':  'Support',
  'lane.unknown':  '—',

  'build.threatProfile.title':    'Enemy team profile',
  'build.threatProfile.subtitle': 'threats to counter',

  'build.threat.ad':       'AD',
  'build.threat.ap':       'AP',
  'build.threat.heal':     'Heal',
  'build.threat.cc':       'CC',
  'build.threat.tank':     'Tank',
  'build.threat.shield':   'Shield',
  'build.threat.engage':   'Engage',
  'build.threat.poke':     'Poke',
  'build.threat.trueDmg':  '%HP/True',

  'build.chip.critCarry':  'Crit ADC — Randuin\'s is strong',
  'build.chip.invisible':  'Invisible enemy — buy Control Wards / Oracle Lens',

  'build.variant.standard':               'Standard',
  'build.variant.standard.description':   'Balanced build based on meta and current enemy threats.',
  'build.variant.aggressive':             'Aggressive',
  'build.variant.aggressive.description': 'More damage (AD/AP/penetration), less defense — faster kills at the cost of survival.',
  'build.variant.defensive':              'Defensive',
  'build.variant.defensive.description':  'Higher survivability (HP/Armor/MR), less damage — for tough matchups.',

  'build.anomaly.title':  'Off-meta detection',

  'build.rush.title':     'Rush components first',

  'build.order.title':     'Build Order',
  'build.order.totalCost': 'Total cost:',

  'build.skillOrder.title':     'Skill Order',
  'build.skillOrder.ariaLabel': 'Skill order by level',

  'anomaly.offMeta':  '{champion} is off-meta ({requestedLane}) — showing meta from {naturalLane}',
  'anomaly.noData':   'No historical data for {champion} ({requestedLane}) — using archetype scoring',

  'earlyComponent.tearRush': 'Buy first — the passive stacks over time, the earlier you buy the Tear the stronger {item} becomes.',

  'reason.armorVsAd':                     'Armor vs AD team ({percent}%)',
  'reason.mrVsAp':                        'MR vs AP team ({percent}%)',
  'reason.gwVsHealing':                   'Grievous Wounds vs enemy healing',
  'reason.gwVsShields':                   'Grievous Wounds (reduced priority — enemy shields {percent}%)',
  'reason.gwAllyCovered':                 'Grievous Wounds (ally already covers — reduced priority)',
  'reason.randuinVsCrit':                 'Randuin\'s vs crit ADC',
  'reason.resistVsTrue':                  'Resistances > HP ({percent}% true/%HP dmg)',
  'reason.hpScalesWithTrue':              'HP scales with enemy %HP dmg (−{penalty})',
  'reason.armorPenCount':                 'Armor Pen vs {count} tanks',
  'reason.magicPenCount':                 'Magic Pen vs {count} tanks',
  'reason.armorPen':                      'Armor Penetration vs tanks',
  'reason.magicPen':                      'Magic Penetration vs tanks',
  'reason.hpVsAssassins':                 'HP vs {count} assassins',
  'reason.defVsBurst':                    'Defense vs burst ({count} champions)',
  'reason.tenacity':                      'Tenacity vs engage CC ({percent}%)',
  'reason.antiEngage':                    'Anti-engage vs dive ({percent}%)',
  'reason.antiPoke':                      'Anti-poke sustain ({percent}%)',
  'reason.proMeta':                       'Pro meta {champion} ({rank}/{total})',
  'reason.goodItem':                      'Good item for {champion}',
  'reason.synergy.ardentFriendly':        'Synergy with {ally} (AS carry)',
  'reason.synergy.ardentUnfriendly':      'Weak with {ally} (no AS scaling)',
  'reason.synergy.flowingWaterMediocre':  'Mediocre with {ally}',
};

// ----------------------------------------------------------------------------
// DEUTSCH
// ----------------------------------------------------------------------------
const de: Dict = {
  'lang.label': 'Sprache',

  'nav.ariaLabel':  'Hauptnavigation',
  'nav.searchGame': 'Spiel suchen',
  'nav.teamShuffle': 'Team-Shuffle',
  'nav.champions': 'Champions',

  'footer.coffee.cta':    'Gefällt dir das Tool? Spendier mir einen Kaffee —',
  'footer.coffee.button': 'Buy me a coffee',
  'footer.cookies':       'Cookies',

  'cookie.banner.message': 'Wir verwenden Google-Analytics-Cookies, um Traffic zu messen und die App zu verbessern. Deine Daten werden außer an GA nicht an Dritte weitergegeben. Wähle, ob du zustimmst — du kannst es jederzeit ändern.',
  'cookie.banner.accept':  'Akzeptieren',
  'cookie.banner.reject':  'Ablehnen',

  'shuffle.title':                     'Team-Shuffle',
  'shuffle.subtitle':                  'Spieler eintragen, shuffeln, Custom Game spielen — ohne Diskussion wer mit wem',
  'shuffle.addPlayer':                 'Spieler hinzufügen',
  'shuffle.removePlayer':              'Spieler entfernen',
  'shuffle.shuffleButton':             'Teams mischen',
  'shuffle.shuffling':                 'Mische...',
  'shuffle.shuffleAgain':              'Neu mischen',
  'shuffle.deciding':                  'Würfle Schicksal...',
  'shuffle.options.randomChampions':   'Zufällige Champions',
  'shuffle.options.randomRoles':       'Zufällige Rollen',
  'shuffle.options.roleAppropriate':   'Champions passend zur Rolle',
  'shuffle.needMorePlayers':           'Mindestens 2 Spielernamen eingeben, um zu starten',
  'shuffle.blueTeam':                  'Blaues Team',
  'shuffle.redTeam':                   'Rotes Team',

  'champions.title':                   'Champions',
  'champions.subtitle':                'Alle League of Legends Champions durchsuchen',
  'champions.search':                  'Champion suchen...',
  'champions.allRoles':                'Alle',
  'champions.noResults':               'Keine Champions gefunden',
  'champion.builds':                   'Builds',
  'champion.abilities':                'Fähigkeiten',
  'champion.passive':                  'Passiv',
  'champion.stats':                    'Statistiken',
  'champion.lore':                     'Geschichte',
  'champion.tips.ally':                'Tipps',
  'champion.tips.enemy':               'Gegen spielen',
  'champion.skillOrder':               'Fähigkeitsreihenfolge',
  'champion.popularItems':             'Beliebte Items',
  'champion.winRate':                  'Siegesrate',
  'champion.pickRate':                 'Pickrate',
  'champion.cooldown':                 'Abklingzeit',
  'champion.cost':                     'Kosten',
  'champion.range':                    'Reichweite',

  'home.hero.title1':      'DRAFT',
  'home.hero.title2':      'SENSE',
  'home.hero.subtitle':    'Smarte Builds, die zu deinem Spiel passen',
  'home.hero.footerHint':  'Basiert auf Riot API · Pro-Meta aus Challenger + Grandmaster',

  'home.form.riotId':                     'Riot ID',
  'home.form.riotId.name.placeholder':    'Name',
  'home.form.riotId.tag.placeholder':     'Tag',
  'home.form.region':                     'Server',
  'home.form.submit':                     'Aktives Spiel suchen',
  'home.form.submit.loading':             'Suche...',
  'home.form.error.emptyFields':          'Bitte gib deine Riot ID ein (Name#TAG).',
  'home.form.error.notInGame':            'Spieler ist nicht im Spiel oder wurde nicht gefunden.',
  'home.form.error.apiKey':               'Ungültiger oder fehlender Riot API-Schlüssel. Backend-Konfiguration prüfen.',
  'home.form.error.generic':              'Ein Fehler ist aufgetreten. Bitte erneut versuchen.',

  'home.seo.h2.features':           'Smarte LoL-Builds, die zu deinem Spiel passen',
  'home.seo.features.p1':           'Jedes League-of-Legends-Match ist anders. Mal heilt sich das Gegnerteam hoch und nichts stirbt, mal springen sie dich an und löschen dich in zwei Sekunden, mal poken sie dich einfach aus der Lane, bevor du überhaupt farmen kannst. DraftSense schaut sich dein aktives Spiel in dem Moment an, in dem du ins Match kommst, und zeigt dir genau, was du kaufen musst, um mit dem umzugehen, was die andere Seite macht. Schluss mit den immer gleichen drei Items aus Gewohnheit — jedes Spiel bekommt einen Build, der wirklich passt.',
  'home.seo.h3.counterBuild':       'Die richtigen Items gegen die richtigen Gegner',
  'home.seo.counterBuild.p1':       'Ein defensives Item, das du nicht brauchst, ist ein verschwendeter Slot. DraftSense schaut zuerst, wer im gegnerischen Team steht, und wählt erst dann die Konter — Heilungsreduktion, wenn sie wirklich heilen, Magieresistenz, wenn ein Bursting-Magier lauert, Überlebens-Items, wenn sie alle zwanzig Sekunden auf dich springen. Wenn das Gegnerteam mehr schildet als heilt, drängen wir dich nicht zu Anti-Heal, das hier nichts bringen würde.',
  'home.seo.h3.rolesChampions':     'Builds passend zu deiner Rolle',
  'home.seo.rolesChampions.p1':     'Ein ADC braucht etwas komplett anderes als ein Support, ein Mid-Mage etwas anderes als ein Top-Bruiser. DraftSense versteht diesen Unterschied. Egal, ob du Zed in der Mitte mainst, Jinx auf der Botlane spielst, Ahri flexibel einsetzt oder Thresh als Support lockst — die Empfehlungen passen zu deiner Position und dem, was dein Team von dir braucht. Jeder Champion in jeder Rolle bekommt einen Build, der Sinn ergibt, wie er wirklich gespielt wird.',
  'home.seo.h3.metaBuilds':         'Mit jedem Patch aktualisiert',
  'home.seo.metaBuilds.p1':         'Die LoL-Meta ändert sich ständig. Ein Build, der letzte Woche noch gecarried hat, kann nach dem nächsten Patch völlig unspielbar sein. DraftSense zieht aktuelle Builds direkt von den besten Spielern — Challenger, Grandmaster und Master — und aktualisiert sie mit jedem Riot-Patch. Du siehst immer, was die Top-Spieler in deiner Region gerade tatsächlich kaufen, nicht einen Guide aus zwei Seasons her.',
  'home.seo.h3.adaptive':           'Drei Builds, du entscheidest',
  'home.seo.adaptive.p1':           'Manche Matches verlangen nach voller Aggression, andere nach reinem Late-Game-Scaling. Jeder Champion in DraftSense kommt mit drei fertigen Varianten — Standard, Aggressiv und Defensiv — alle zugeschnitten auf das spezifische Gegnerteam, dem du gerade gegenüberstehst. Willst du voll drauf? Aggressiv maximiert den Schaden. Wirst du vom Tank-Jungler gedivet? Defensiv rusht Überleben. Unsicher? Standard spielt auf Nummer sicher. Ein Klick, alle drei sehen, den passenden wählen.',
  'home.seo.disclaimer':            'DraftSense wird nicht von Riot Games unterstützt und spiegelt nicht die Ansichten oder Meinungen von Riot Games oder jemandem wider, der offiziell an der Produktion oder Verwaltung von League of Legends beteiligt ist.',

  'game.live':            'Laufendes Spiel',
  'game.title':           'Kluft der Beschwörer',
  'game.back':            'Zurück',
  'game.backToSearch':    'Zurück zur Suche',
  'game.loading':         'Spiel wird geladen...',
  'game.forging':         'Build wird geschmiedet...',
  'game.noGame':          'Keine Spieldaten. Zurück und nach einem Spiel suchen.',
  'game.bans':            'Banns',
  'game.noBans':          'Keine Banns',
  'game.blueTeam':        'Blaues Team',
  'game.redTeam':         'Rotes Team',
  'game.players':         'Spieler',
  'game.you':             'DU',
  'game.unknown':         'Unbekannt',
  'game.vs':              'VS',
  'game.dragHint':        'Ziehen, um die Lane mit einem anderen Spieler dieses Teams zu tauschen',
  'game.selectChampion':  'Champion wählen, um seinen Build zu schmieden',

  'lane.top':      'Top',
  'lane.jungle':   'Jungle',
  'lane.middle':   'Mid',
  'lane.bottom':   'Bot',
  'lane.utility':  'Support',
  'lane.unknown':  '—',

  'build.threatProfile.title':    'Gegnerisches Team',
  'build.threatProfile.subtitle': 'Bedrohungen zu kontern',

  'build.threat.ad':       'AD',
  'build.threat.ap':       'AP',
  'build.threat.heal':     'Heal',
  'build.threat.cc':       'CC',
  'build.threat.tank':     'Tank',
  'build.threat.shield':   'Schild',
  'build.threat.engage':   'Engage',
  'build.threat.poke':     'Poke',
  'build.threat.trueDmg':  '%HP/True',

  'build.chip.critCarry':  'Crit-ADC — Randuin\'s ist stark',
  'build.chip.invisible':  'Unsichtbarer Gegner — kaufe Kontrollwächter / Orakellinse',

  'build.variant.standard':               'Standard',
  'build.variant.standard.description':   'Ausgewogener Build basierend auf Meta und aktuellen Bedrohungen.',
  'build.variant.aggressive':             'Aggressiv',
  'build.variant.aggressive.description': 'Mehr Schaden (AD/AP/Penetration), weniger Verteidigung — schnellere Kills auf Kosten des Überlebens.',
  'build.variant.defensive':              'Defensiv',
  'build.variant.defensive.description':  'Höhere Überlebensfähigkeit (HP/Rüstung/MR), weniger Schaden — für schwierige Matchups.',

  'build.anomaly.title':  'Off-Meta erkannt',

  'build.rush.title':     'Zuerst kaufen — Komponenten',

  'build.order.title':     'Kaufreihenfolge',
  'build.order.totalCost': 'Gesamtkosten:',

  'build.skillOrder.title':     'Fähigkeiten-Reihenfolge',
  'build.skillOrder.ariaLabel': 'Fähigkeiten-Reihenfolge nach Level',

  'anomaly.offMeta':  '{champion} off-meta ({requestedLane}) — zeige Meta von {naturalLane}',
  'anomaly.noData':   'Keine historischen Daten für {champion} ({requestedLane}) — verwende Archetyp-Scoring',

  'earlyComponent.tearRush': 'Zuerst kaufen — die Passive stapelt sich mit der Zeit, je früher du die Träne kaufst, desto stärker wird {item}.',

  'reason.armorVsAd':                     'Rüstung vs AD-Team ({percent}%)',
  'reason.mrVsAp':                        'MR vs AP-Team ({percent}%)',
  'reason.gwVsHealing':                   'Grievous Wounds vs gegnerische Heilung',
  'reason.gwVsShields':                   'Grievous Wounds (reduzierte Priorität — Gegner schildet {percent}%)',
  'reason.gwAllyCovered':                 'Grievous Wounds (Verbündeter deckt bereits ab — reduzierte Priorität)',
  'reason.randuinVsCrit':                 'Randuin\'s vs Crit-ADC',
  'reason.resistVsTrue':                  'Resistenzen > HP ({percent}% True/%HP Schaden)',
  'reason.hpScalesWithTrue':              'HP skaliert mit %HP-Schaden (−{penalty})',
  'reason.armorPenCount':                 'Rüstungsdurchdringung vs {count} Tanks',
  'reason.magicPenCount':                 'Magiedurchdringung vs {count} Tanks',
  'reason.armorPen':                      'Rüstungsdurchdringung vs Tanks',
  'reason.magicPen':                      'Magiedurchdringung vs Tanks',
  'reason.hpVsAssassins':                 'HP vs {count} Assassinen',
  'reason.defVsBurst':                    'Verteidigung vs Burst ({count} Champions)',
  'reason.tenacity':                      'Widerstand vs Engage CC ({percent}%)',
  'reason.antiEngage':                    'Anti-Engage vs Dive ({percent}%)',
  'reason.antiPoke':                      'Anti-Poke Sustain ({percent}%)',
  'reason.proMeta':                       'Pro-Meta {champion} ({rank}/{total})',
  'reason.goodItem':                      'Guter Gegenstand für {champion}',
  'reason.synergy.ardentFriendly':        'Synergie mit {ally} (AS-Carry)',
  'reason.synergy.ardentUnfriendly':      'Schwach mit {ally} (keine AS-Skalierung)',
  'reason.synergy.flowingWaterMediocre':  'Mittelmäßig mit {ally}',
};

// ----------------------------------------------------------------------------
// ESPAÑOL
// ----------------------------------------------------------------------------
const es: Dict = {
  'lang.label': 'Idioma',

  'nav.ariaLabel':  'Navegación principal',
  'nav.searchGame': 'Buscar partida',
  'nav.teamShuffle': 'Sorteo de equipos',
  'nav.champions': 'Campeones',

  'footer.coffee.cta':    '¿Te gusta la herramienta? Invítame un café —',
  'footer.coffee.button': 'Buy me a coffee',
  'footer.cookies':       'Cookies',

  'cookie.banner.message': 'Usamos cookies de Google Analytics para medir el tráfico y mejorar la aplicación. Tus datos no se comparten con nadie salvo GA. Elige si aceptas — puedes cambiar de opinión en cualquier momento.',
  'cookie.banner.accept':  'Aceptar',
  'cookie.banner.reject':  'Rechazar',

  'shuffle.title':                     'Sorteo de equipos',
  'shuffle.subtitle':                  'Escribe los jugadores, pulsa sortear, juega tu custom sin discutir quién va con quién',
  'shuffle.addPlayer':                 'Añadir jugador',
  'shuffle.removePlayer':              'Eliminar jugador',
  'shuffle.shuffleButton':             'Sortear equipos',
  'shuffle.shuffling':                 'Sorteando...',
  'shuffle.shuffleAgain':              'Sortear de nuevo',
  'shuffle.deciding':                  'Lanzando los dados...',
  'shuffle.options.randomChampions':   'Campeones aleatorios',
  'shuffle.options.randomRoles':       'Roles aleatorios',
  'shuffle.options.roleAppropriate':   'Campeones adaptados al rol',
  'shuffle.needMorePlayers':           'Introduce al menos 2 jugadores para empezar',
  'shuffle.blueTeam':                  'Equipo Azul',
  'shuffle.redTeam':                   'Equipo Rojo',

  'champions.title':                   'Campeones',
  'champions.subtitle':                'Explora todos los campeones de League of Legends',
  'champions.search':                  'Buscar campeón...',
  'champions.allRoles':                'Todos',
  'champions.noResults':               'No se encontraron campeones',
  'champion.builds':                   'Builds',
  'champion.abilities':                'Habilidades',
  'champion.passive':                  'Pasiva',
  'champion.stats':                    'Estadísticas',
  'champion.lore':                     'Historia',
  'champion.tips.ally':                'Consejos',
  'champion.tips.enemy':               'Jugar contra',
  'champion.skillOrder':               'Orden de habilidades',
  'champion.popularItems':             'Items populares',
  'champion.winRate':                  'Victorias',
  'champion.pickRate':                 'Selección',
  'champion.cooldown':                 'Enfriamiento',
  'champion.cost':                     'Coste',
  'champion.range':                    'Alcance',

  'home.hero.title1':      'DRAFT',
  'home.hero.title2':      'SENSE',
  'home.hero.subtitle':    'Builds inteligentes que encajan con tu partida',
  'home.hero.footerHint':  'Impulsado por Riot API · Pro meta de Challenger + Grandmaster',

  'home.form.riotId':                     'Riot ID',
  'home.form.riotId.name.placeholder':    'Nombre',
  'home.form.riotId.tag.placeholder':     'Tag',
  'home.form.region':                     'Servidor',
  'home.form.submit':                     'Buscar partida activa',
  'home.form.submit.loading':             'Buscando...',
  'home.form.error.emptyFields':          'Por favor, introduce tu Riot ID (Nombre#TAG).',
  'home.form.error.notInGame':            'El jugador no está en una partida o no se ha encontrado.',
  'home.form.error.apiKey':               'Clave API de Riot inválida o ausente. Revisa la configuración del backend.',
  'home.form.error.generic':              'Ha ocurrido un error. Inténtalo de nuevo.',

  'home.seo.h2.features':           'Builds inteligentes de LoL que encajan con tu partida',
  'home.seo.features.p1':           'Cada partida de League of Legends es diferente. A veces el equipo enemigo se cura tanto que no muere nadie, a veces se tiran encima y te borran en dos segundos, a veces simplemente te hacen poke hasta sacarte de línea antes de poder farmear. DraftSense revisa tu partida activa en el momento en que entras y te muestra exactamente qué comprar para manejar lo que sea que tenga el otro lado. Se acabó comprar los mismos tres ítems por costumbre — cada partida recibe un build que realmente encaja.',
  'home.seo.h3.counterBuild':       'Los ítems correctos contra los enemigos correctos',
  'home.seo.counterBuild.p1':       'Un ítem defensivo que no necesitas es un slot perdido. DraftSense primero mira quién está en el equipo enemigo y solo entonces elige los counters — reducción de curación cuando realmente se curan, resistencia mágica cuando hay un mago de burst, ítems de supervivencia cuando se te tiran encima cada veinte segundos. Si el equipo enemigo escuda más de lo que se cura, no te empujamos hacia anti-curación que aquí no haría nada.',
  'home.seo.h3.rolesChampions':     'Builds adaptados a tu rol',
  'home.seo.rolesChampions.p1':     'Un ADC necesita algo completamente distinto a un support, un mid mago algo distinto a un top bruiser. DraftSense lo entiende. Ya sea que mainees Zed en el medio, juegues Jinx en el bot, flexees Ahri por el mapa o lockees Thresh support — las recomendaciones se ajustan a tu posición y a lo que tu equipo realmente necesita de ti. Cada campeón en cada rol recibe un build que tiene sentido por cómo se juega en realidad.',
  'home.seo.h3.metaBuilds':         'Actualizados con cada parche',
  'home.seo.metaBuilds.p1':         'La meta de LoL cambia constantemente. Un build que carry\'ó la semana pasada puede ser completamente injugable tras el siguiente parche. DraftSense trae builds actuales directamente de los mejores jugadores — Challenger, Gran Maestro y Maestro — y los actualiza con cada parche de Riot. Siempre ves lo que los mejores jugadores de tu región están comprando ahora mismo, no una guía de hace dos temporadas.',
  'home.seo.h3.adaptive':           'Tres builds, tú eliges',
  'home.seo.adaptive.p1':           'Algunas partidas piden all-in total, otras escalado puro hacia late game. Cada campeón en DraftSense viene con tres variantes listas — Estándar, Agresiva y Defensiva — todas adaptadas al equipo enemigo específico al que te enfrentas ahora. ¿Quieres ir a por el cuello? La agresiva maximiza daño. ¿Te están diveando con el jungla tank? La defensiva rushea supervivencia. ¿No estás seguro? La estándar juega a lo seguro. Un clic, ves las tres, eliges la que sientes.',
  'home.seo.disclaimer':            'DraftSense no está respaldado por Riot Games y no refleja los puntos de vista u opiniones de Riot Games ni de nadie oficialmente involucrado en la producción o gestión de League of Legends.',

  'game.live':            'Partida en vivo',
  'game.title':           'Grieta del Invocador',
  'game.back':            'Atrás',
  'game.backToSearch':    'Volver a la búsqueda',
  'game.loading':         'Cargando partida...',
  'game.forging':         'Forjando build...',
  'game.noGame':          'Sin datos de partida. Vuelve y busca una partida.',
  'game.bans':            'Baneos',
  'game.noBans':          'Sin baneos',
  'game.blueTeam':        'Equipo Azul',
  'game.redTeam':         'Equipo Rojo',
  'game.players':         'jugadores',
  'game.you':             'TÚ',
  'game.unknown':         'Desconocido',
  'game.vs':              'VS',
  'game.dragHint':        'Arrastra para intercambiar línea con otro jugador de este equipo',
  'game.selectChampion':  'Selecciona un campeón para forjar su build',

  'lane.top':      'Top',
  'lane.jungle':   'Jungla',
  'lane.middle':   'Mid',
  'lane.bottom':   'Bot',
  'lane.utility':  'Support',
  'lane.unknown':  '—',

  'build.threatProfile.title':    'Perfil del equipo enemigo',
  'build.threatProfile.subtitle': 'amenazas a contrarrestar',

  'build.threat.ad':       'AD',
  'build.threat.ap':       'AP',
  'build.threat.heal':     'Curación',
  'build.threat.cc':       'CC',
  'build.threat.tank':     'Tanque',
  'build.threat.shield':   'Escudo',
  'build.threat.engage':   'Engage',
  'build.threat.poke':     'Poke',
  'build.threat.trueDmg':  '%HP/True',

  'build.chip.critCarry':  'ADC crítico — Randuin\'s es fuerte',
  'build.chip.invisible':  'Enemigo invisible — compra Guardianes de Control / Lente Oráculo',

  'build.variant.standard':               'Estándar',
  'build.variant.standard.description':   'Build equilibrado basado en la meta y las amenazas actuales del enemigo.',
  'build.variant.aggressive':             'Agresivo',
  'build.variant.aggressive.description': 'Más daño (AD/AP/penetración), menos defensa — asesinatos más rápidos a costa de supervivencia.',
  'build.variant.defensive':              'Defensivo',
  'build.variant.defensive.description':  'Mayor supervivencia (HP/Armadura/MR), menos daño — para matchups difíciles.',

  'build.anomaly.title':  'Detección off-meta',

  'build.rush.title':     'Componentes a comprar primero',

  'build.order.title':     'Orden de compra',
  'build.order.totalCost': 'Costo total:',

  'build.skillOrder.title':     'Orden de habilidades',
  'build.skillOrder.ariaLabel': 'Orden de habilidades por nivel',

  'anomaly.offMeta':  '{champion} off-meta ({requestedLane}) — mostrando meta de {naturalLane}',
  'anomaly.noData':   'Sin datos históricos para {champion} ({requestedLane}) — usando puntuación por arquetipo',

  'earlyComponent.tearRush': 'Compra primero — la pasiva se acumula con el tiempo, cuanto antes compres la Lágrima más fuerte será {item}.',

  'reason.armorVsAd':                     'Armadura vs equipo AD ({percent}%)',
  'reason.mrVsAp':                        'MR vs equipo AP ({percent}%)',
  'reason.gwVsHealing':                   'Heridas Incurables vs curación enemiga',
  'reason.gwVsShields':                   'Heridas Incurables (prioridad reducida — enemigos escudan {percent}%)',
  'reason.gwAllyCovered':                 'Heridas Incurables (aliado ya lo cubre — prioridad reducida)',
  'reason.randuinVsCrit':                 'Ímpetu de Randuin vs ADC crítico',
  'reason.resistVsTrue':                  'Resistencias > HP ({percent}% daño verdadero/%HP)',
  'reason.hpScalesWithTrue':              'HP escala con daño %HP enemigo (−{penalty})',
  'reason.armorPenCount':                 'Penetración de armadura vs {count} tanques',
  'reason.magicPenCount':                 'Penetración mágica vs {count} tanques',
  'reason.armorPen':                      'Penetración de armadura vs tanques',
  'reason.magicPen':                      'Penetración mágica vs tanques',
  'reason.hpVsAssassins':                 'HP vs {count} asesinos',
  'reason.defVsBurst':                    'Defensa vs burst ({count} campeones)',
  'reason.tenacity':                      'Tenacidad vs engage CC ({percent}%)',
  'reason.antiEngage':                    'Anti-engage vs dive ({percent}%)',
  'reason.antiPoke':                      'Sustain anti-poke ({percent}%)',
  'reason.proMeta':                       'Pro meta {champion} ({rank}/{total})',
  'reason.goodItem':                      'Buen objeto para {champion}',
  'reason.synergy.ardentFriendly':        'Sinergia con {ally} (carry AS)',
  'reason.synergy.ardentUnfriendly':      'Débil con {ally} (sin escalado de AS)',
  'reason.synergy.flowingWaterMediocre':  'Mediocre con {ally}',
};

// ----------------------------------------------------------------------------
// РУССКИЙ
// ----------------------------------------------------------------------------
const ru: Dict = {
  'lang.label': 'Язык',

  'nav.ariaLabel':  'Основная навигация',
  'nav.searchGame': 'Поиск игры',
  'nav.teamShuffle': 'Разделение команд',
  'nav.champions': 'Чемпионы',

  'footer.coffee.cta':    'Нравится инструмент? Поставь кофе —',
  'footer.coffee.button': 'Buy me a coffee',
  'footer.cookies':       'Cookies',

  'cookie.banner.message': 'Мы используем cookies Google Analytics, чтобы измерять трафик и улучшать приложение. Твои данные не передаются никому, кроме GA. Выбери, согласен ли ты — можешь изменить решение в любой момент.',
  'cookie.banner.accept':  'Принять',
  'cookie.banner.reject':  'Отклонить',

  'shuffle.title':                     'Разделение команд',
  'shuffle.subtitle':                  'Введи игроков, нажми разделить, играй кастом без споров кто с кем',
  'shuffle.addPlayer':                 'Добавить игрока',
  'shuffle.removePlayer':              'Удалить игрока',
  'shuffle.shuffleButton':             'Разделить команды',
  'shuffle.shuffling':                 'Разделение...',
  'shuffle.shuffleAgain':              'Разделить ещё раз',
  'shuffle.deciding':                  'Бросаю жребий...',
  'shuffle.options.randomChampions':   'Случайные чемпионы',
  'shuffle.options.randomRoles':       'Случайные роли',
  'shuffle.options.roleAppropriate':   'Чемпионы под роль',
  'shuffle.needMorePlayers':           'Введи минимум 2 игрока, чтобы начать',
  'shuffle.blueTeam':                  'Синяя команда',
  'shuffle.redTeam':                   'Красная команда',

  'champions.title':                   'Чемпионы',
  'champions.subtitle':                'Все чемпионы League of Legends',
  'champions.search':                  'Найти чемпиона...',
  'champions.allRoles':                'Все',
  'champions.noResults':               'Чемпионы не найдены',
  'champion.builds':                   'Сборки',
  'champion.abilities':                'Способности',
  'champion.passive':                  'Пассивная',
  'champion.stats':                    'Характеристики',
  'champion.lore':                     'История',
  'champion.tips.ally':                'Советы',
  'champion.tips.enemy':               'Игра против',
  'champion.skillOrder':               'Порядок навыков',
  'champion.popularItems':             'Популярные предметы',
  'champion.winRate':                  'Победы',
  'champion.pickRate':                 'Пикрейт',
  'champion.cooldown':                 'Перезарядка',
  'champion.cost':                     'Стоимость',
  'champion.range':                    'Дальность',

  'home.hero.title1':      'DRAFT',
  'home.hero.title2':      'SENSE',
  'home.hero.subtitle':    'Умные билды под твою игру',
  'home.hero.footerHint':  'На базе Riot API · Про-мета из Challenger + Grandmaster',

  'home.form.riotId':                     'Riot ID',
  'home.form.riotId.name.placeholder':    'Имя',
  'home.form.riotId.tag.placeholder':     'Тег',
  'home.form.region':                     'Сервер',
  'home.form.submit':                     'Найти активную игру',
  'home.form.submit.loading':             'Поиск...',
  'home.form.error.emptyFields':          'Введите ваш Riot ID (Имя#TAG).',
  'home.form.error.notInGame':            'Игрок сейчас не в игре или не найден.',
  'home.form.error.apiKey':               'Неверный или отсутствующий ключ Riot API. Проверьте конфигурацию бэкенда.',
  'home.form.error.generic':              'Произошла ошибка. Попробуйте снова.',

  'home.seo.h2.features':           'Умные билды LoL, подобранные под твою игру',
  'home.seo.features.p1':           'Каждый матч в League of Legends другой. Иногда враги стакают хил и ничего не умирает, иногда они прыгают на тебя и сливают за две секунды, иногда просто пукают тебя с лайна, пока ты пытаешься фармить. DraftSense проверяет твою активную игру прямо в момент загрузки и показывает, что именно купить, чтобы справиться с тем, что делает другая команда. Больше никаких трёх одинаковых предметов по привычке — каждая игра получает билд, который реально подходит.',
  'home.seo.h3.counterBuild':       'Правильные предметы против правильных врагов',
  'home.seo.counterBuild.p1':       'Защитный предмет, который тебе не нужен — это потраченный слот. DraftSense сначала смотрит, кто во вражеской команде, и только потом выбирает контры — снижение лечения, когда они реально лечатся, магическое сопротивление, когда рядом бурст-маг, предметы выживания, когда на тебя прыгают каждые двадцать секунд. Если вражеская команда тарчит больше, чем лечится, мы не будем толкать тебя к анти-хилу, который здесь ничего не даст.',
  'home.seo.h3.rolesChampions':     'Билды под твою роль',
  'home.seo.rolesChampions.p1':     'ADC нужно совсем не то, что саппорту, мид-магу совсем не то, что топ-брузеру. DraftSense это понимает. Неважно, мейнишь ты Zed-а в миду, играешь Jinx на боте, флексишь Ahri по карте или локаешь Thresh-а на саппорте — рекомендации подходят под твою позицию и то, что команде от тебя нужно. Каждый чемпион в каждой роли получает билд, который имеет смысл именно для того, как им реально играют.',
  'home.seo.h3.metaBuilds':         'Обновляются с каждым патчем',
  'home.seo.metaBuilds.p1':         'Мета LoL постоянно меняется. Билд, который ещё на прошлой неделе керрил, после следующего патча может быть абсолютно неиграбельным. DraftSense подтягивает актуальные билды прямо от лучших игроков — Challenger, Grandmaster и Master — и обновляет их с каждым патчем Riot. Ты всегда видишь то, что топ-игроки твоего региона реально покупают прямо сейчас, а не гайд двухлетней давности.',
  'home.seo.h3.adaptive':           'Три билда — ты выбираешь',
  'home.seo.adaptive.p1':           'Одни матчи просят полного all-in-а, другие — чистого скейлинга в лейт. Каждый чемпион в DraftSense идёт с тремя готовыми вариантами — Стандартный, Агрессивный и Защитный — и все они подогнаны именно под ту вражескую команду, с которой ты сейчас столкнулся. Хочешь в горло? Агрессивный максит урон. Дайвят тебя танк-джанглером? Защитный рашит выживаемость. Сомневаешься? Стандартный играет безопасно. Один клик, видишь все три, выбираешь ту, что ощущается правильно.',
  'home.seo.disclaimer':            'DraftSense не связан с Riot Games и не отражает взгляды или мнения Riot Games или кого-либо, официально вовлечённого в производство или управление League of Legends.',

  'game.live':            'Активный матч',
  'game.title':           'Ущелье призывателей',
  'game.back':            'Назад',
  'game.backToSearch':    'Назад к поиску',
  'game.loading':         'Загрузка матча...',
  'game.forging':         'Кую билд...',
  'game.noGame':          'Нет данных матча. Вернитесь и найдите игру.',
  'game.bans':            'Баны',
  'game.noBans':          'Нет банов',
  'game.blueTeam':        'Синяя команда',
  'game.redTeam':         'Красная команда',
  'game.players':         'игроков',
  'game.you':             'ВЫ',
  'game.unknown':         'Неизвестно',
  'game.vs':              'VS',
  'game.dragHint':        'Перетащите, чтобы поменять линию с другим игроком в этой команде',
  'game.selectChampion':  'Выберите чемпиона, чтобы выковать его билд',

  'lane.top':      'Топ',
  'lane.jungle':   'Лес',
  'lane.middle':   'Мид',
  'lane.bottom':   'Бот',
  'lane.utility':  'Саппорт',
  'lane.unknown':  '—',

  'build.threatProfile.title':    'Профиль вражеской команды',
  'build.threatProfile.subtitle': 'угрозы для контры',

  'build.threat.ad':       'AD',
  'build.threat.ap':       'AP',
  'build.threat.heal':     'Хил',
  'build.threat.cc':       'CC',
  'build.threat.tank':     'Танк',
  'build.threat.shield':   'Щит',
  'build.threat.engage':   'Инициация',
  'build.threat.poke':     'Поук',
  'build.threat.trueDmg':  '%HP/True',

  'build.chip.critCarry':  'Крит ADC — Randuin\'s полезен',
  'build.chip.invisible':  'Невидимый враг — покупайте Контрольные варды / Око оракула',

  'build.variant.standard':               'Стандартный',
  'build.variant.standard.description':   'Сбалансированный билд на основе меты и текущих угроз врага.',
  'build.variant.aggressive':             'Агрессивный',
  'build.variant.aggressive.description': 'Больше урона (AD/AP/пен), меньше защиты — быстрые убийства ценой выживаемости.',
  'build.variant.defensive':              'Защитный',
  'build.variant.defensive.description':  'Выше выживаемость (HP/Армор/MR), меньше урона — для сложных матчапов.',

  'build.anomaly.title':  'Обнаружен off-meta',

  'build.rush.title':     'Купить первыми — компоненты',

  'build.order.title':     'Порядок покупки',
  'build.order.totalCost': 'Общая стоимость:',

  'build.skillOrder.title':     'Порядок умений',
  'build.skillOrder.ariaLabel': 'Порядок умений по уровню',

  'anomaly.offMeta':  '{champion} off-meta ({requestedLane}) — показываю мету ({naturalLane})',
  'anomaly.noData':   'Нет исторических данных для {champion} ({requestedLane}) — используется архетипный скоринг',

  'earlyComponent.tearRush': 'Купить первым — пассивка стакается со временем, чем раньше купишь Слезу, тем сильнее будет {item}.',

  'reason.armorVsAd':                     'Армор vs AD-команда ({percent}%)',
  'reason.mrVsAp':                        'MR vs AP-команда ({percent}%)',
  'reason.gwVsHealing':                   'Grievous Wounds vs хил противника',
  'reason.gwVsShields':                   'Grievous Wounds (сниженный приоритет — враг тарчует {percent}%)',
  'reason.gwAllyCovered':                 'Grievous Wounds (союзник уже покрывает — сниженный приоритет)',
  'reason.randuinVsCrit':                 'Randuin\'s vs крит ADC',
  'reason.resistVsTrue':                  'Сопротивление > HP ({percent}% true/%HP урон)',
  'reason.hpScalesWithTrue':              'HP скейлится с %HP уроном врага (−{penalty})',
  'reason.armorPenCount':                 'Пробивание брони vs {count} танков',
  'reason.magicPenCount':                 'Магическое пробивание vs {count} танков',
  'reason.armorPen':                      'Пробивание брони vs танки',
  'reason.magicPen':                      'Магическое пробивание vs танки',
  'reason.hpVsAssassins':                 'HP vs {count} ассасинов',
  'reason.defVsBurst':                    'Защита vs бурст ({count} чемпионов)',
  'reason.tenacity':                      'Tenacity vs engage CC ({percent}%)',
  'reason.antiEngage':                    'Анти-engage vs dive ({percent}%)',
  'reason.antiPoke':                      'Анти-поук сустейн ({percent}%)',
  'reason.proMeta':                       'Про-мета {champion} ({rank}/{total})',
  'reason.goodItem':                      'Хороший предмет для {champion}',
  'reason.synergy.ardentFriendly':        'Синергия с {ally} (AS-керри)',
  'reason.synergy.ardentUnfriendly':      'Слабо с {ally} (нет скейла AS)',
  'reason.synergy.flowingWaterMediocre':  'Средне с {ally}',
};

// ----------------------------------------------------------------------------
// УКРАЇНСЬКА
// ----------------------------------------------------------------------------
const uk: Dict = {
  'lang.label': 'Мова',

  'nav.ariaLabel':  'Основна навігація',
  'nav.searchGame': 'Пошук гри',
  'nav.teamShuffle': 'Розподіл команд',
  'nav.champions': 'Чемпіони',

  'footer.coffee.cta':    'Подобається інструмент? Пригости кавою —',
  'footer.coffee.button': 'Buy me a coffee',
  'footer.cookies':       'Cookies',

  'cookie.banner.message': 'Ми використовуємо cookies Google Analytics, щоб вимірювати трафік і покращувати застосунок. Твої дані не передаються нікому, крім GA. Обери, чи ти згоден — можеш змінити рішення будь-коли.',
  'cookie.banner.accept':  'Прийняти',
  'cookie.banner.reject':  'Відхилити',

  'shuffle.title':                     'Розподіл команд',
  'shuffle.subtitle':                  'Введи гравців, натисни розподілити, грай кастом без суперечок хто з ким',
  'shuffle.addPlayer':                 'Додати гравця',
  'shuffle.removePlayer':              'Видалити гравця',
  'shuffle.shuffleButton':             'Розподілити команди',
  'shuffle.shuffling':                 'Розподіляю...',
  'shuffle.shuffleAgain':              'Розподілити ще раз',
  'shuffle.deciding':                  'Кидаю жереб...',
  'shuffle.options.randomChampions':   'Випадкові чемпіони',
  'shuffle.options.randomRoles':       'Випадкові ролі',
  'shuffle.options.roleAppropriate':   'Чемпіони за роллю',
  'shuffle.needMorePlayers':           'Введи мінімум 2 гравців, щоб почати',
  'shuffle.blueTeam':                  'Синя команда',
  'shuffle.redTeam':                   'Червона команда',

  'champions.title':                   'Чемпіони',
  'champions.subtitle':                'Усі чемпіони League of Legends',
  'champions.search':                  'Знайти чемпіона...',
  'champions.allRoles':                'Усі',
  'champions.noResults':               'Чемпіонів не знайдено',
  'champion.builds':                   'Збірки',
  'champion.abilities':                'Здібності',
  'champion.passive':                  'Пасивна',
  'champion.stats':                    'Характеристики',
  'champion.lore':                     'Історія',
  'champion.tips.ally':                'Поради',
  'champion.tips.enemy':               'Гра проти',
  'champion.skillOrder':               'Порядок навичок',
  'champion.popularItems':             'Популярні предмети',
  'champion.winRate':                  'Перемоги',
  'champion.pickRate':                 'Пікрейт',
  'champion.cooldown':                 'Перезарядка',
  'champion.cost':                     'Вартість',
  'champion.range':                    'Дальність',

  'home.hero.title1':      'DRAFT',
  'home.hero.title2':      'SENSE',
  'home.hero.subtitle':    'Розумні білди під твою гру',
  'home.hero.footerHint':  'На базі Riot API · Про-мета з Challenger + Grandmaster',

  'home.form.riotId':                     'Riot ID',
  'home.form.riotId.name.placeholder':    'Ім\'я',
  'home.form.riotId.tag.placeholder':     'Тег',
  'home.form.region':                     'Сервер',
  'home.form.submit':                     'Знайти активну гру',
  'home.form.submit.loading':             'Пошук...',
  'home.form.error.emptyFields':          'Введіть свій Riot ID (Ім\'я#TAG).',
  'home.form.error.notInGame':            'Гравець зараз не в грі або його не знайдено.',
  'home.form.error.apiKey':               'Невірний або відсутній ключ Riot API. Перевірте конфігурацію бекенду.',
  'home.form.error.generic':              'Сталася помилка. Спробуйте ще раз.',

  'home.seo.h2.features':           'Розумні білди LoL під твою гру',
  'home.seo.features.p1':           'Кожен матч у League of Legends інший. Іноді вороги стакають хіл і нічого не помирає, іноді вони стрибають на тебе і зносять за дві секунди, іноді вони просто пукають тебе з лайну, перш ніж ти встигаєш фармити. DraftSense перевіряє твою активну гру в момент завантаження і показує, що саме купити, щоб впоратись з тим, що робить інша команда. Більше ніяких трьох однакових предметів за звичкою — кожна гра отримує білд, який реально підходить.',
  'home.seo.h3.counterBuild':       'Правильні предмети проти правильних ворогів',
  'home.seo.counterBuild.p1':       'Захисний предмет, який тобі не потрібен — це втрачений слот. DraftSense спочатку дивиться, хто у ворожій команді, і тільки потім вибирає контри — зниження лікування, коли вони реально лікуються, магічний опір, коли поруч бурст-маг, предмети виживання, коли на тебе стрибають кожні двадцять секунд. Якщо ворожа команда тарчить більше, ніж лікується, ми не штовхатимемо тебе до анти-хілу, який тут нічого не дасть.',
  'home.seo.h3.rolesChampions':     'Білди під твою роль',
  'home.seo.rolesChampions.p1':     'ADC потребує зовсім іншого, ніж саппорт, мід-маг зовсім іншого, ніж топ-брузер. DraftSense це розуміє. Неважливо, мейниш ти Zed-а у міду, граєш Jinx на боті, флексиш Ahri по карті чи локиш Thresh-а на саппорті — рекомендації підходять під твою позицію і те, що команда від тебе потребує. Кожен чемпіон у кожній ролі отримує білд, який має сенс саме для того, як ним реально грають.',
  'home.seo.h3.metaBuilds':         'Оновлюються з кожним патчем',
  'home.seo.metaBuilds.p1':         'Мета LoL постійно змінюється. Білд, який ще минулого тижня керрив, після наступного патчу може бути повністю неграбельним. DraftSense підтягує актуальні білди прямо від найкращих гравців — Challenger, Grandmaster і Master — і оновлює їх з кожним патчем Riot. Ти завжди бачиш те, що топ-гравці твого регіону реально купують зараз, а не гайд дворічної давнини.',
  'home.seo.h3.adaptive':           'Три білди — ти вибираєш',
  'home.seo.adaptive.p1':           'Одні матчі просять повного all-in-у, інші — чистого скейлінгу в лейт. Кожен чемпіон у DraftSense має три готові варіанти — Стандартний, Агресивний і Захисний — і всі вони підігнані саме під ту ворожу команду, з якою ти зараз зіткнувся. Хочеш у горло? Агресивний максить шкоду. Дайвлять тебе танк-джанглером? Захисний рашить виживаність. Сумніваєшся? Стандартний грає безпечно. Один клік, бачиш усі три, вибираєш ту, що відчувається правильно.',
  'home.seo.disclaimer':            'DraftSense не пов\'язаний з Riot Games і не відображає погляди чи думки Riot Games або будь-кого, хто офіційно залучений до виробництва чи керування League of Legends.',

  'game.live':            'Активний матч',
  'game.title':           'Ущелина Прикликачів',
  'game.back':            'Назад',
  'game.backToSearch':    'Назад до пошуку',
  'game.loading':         'Завантаження матчу...',
  'game.forging':         'Кую білд...',
  'game.noGame':          'Немає даних матчу. Поверніться й знайдіть гру.',
  'game.bans':            'Бани',
  'game.noBans':          'Немає банів',
  'game.blueTeam':        'Синя команда',
  'game.redTeam':         'Червона команда',
  'game.players':         'гравців',
  'game.you':             'ВИ',
  'game.unknown':         'Невідомий',
  'game.vs':              'VS',
  'game.dragHint':        'Перетягніть, щоб поміняти лінію з іншим гравцем цієї команди',
  'game.selectChampion':  'Оберіть чемпіона, щоб викувати його білд',

  'lane.top':      'Топ',
  'lane.jungle':   'Ліс',
  'lane.middle':   'Мід',
  'lane.bottom':   'Бот',
  'lane.utility':  'Саппорт',
  'lane.unknown':  '—',

  'build.threatProfile.title':    'Профіль ворожої команди',
  'build.threatProfile.subtitle': 'загрози для контрування',

  'build.threat.ad':       'AD',
  'build.threat.ap':       'AP',
  'build.threat.heal':     'Хіл',
  'build.threat.cc':       'CC',
  'build.threat.tank':     'Танк',
  'build.threat.shield':   'Щит',
  'build.threat.engage':   'Ініціація',
  'build.threat.poke':     'Поук',
  'build.threat.trueDmg':  '%HP/True',

  'build.chip.critCarry':  'Крит ADC — Randuin\'s корисний',
  'build.chip.invisible':  'Невидимий ворог — купіть Контрольні варди / Око оракула',

  'build.variant.standard':               'Стандартний',
  'build.variant.standard.description':   'Збалансований білд на основі мети та поточних загроз ворога.',
  'build.variant.aggressive':             'Агресивний',
  'build.variant.aggressive.description': 'Більше шкоди (AD/AP/пен), менше захисту — швидші вбивства ціною виживання.',
  'build.variant.defensive':              'Захисний',
  'build.variant.defensive.description':  'Вища виживаність (HP/Армор/MR), менше шкоди — для складних матчапів.',

  'build.anomaly.title':  'Виявлено off-meta',

  'build.rush.title':     'Купити першим — компоненти',

  'build.order.title':     'Порядок купівлі',
  'build.order.totalCost': 'Загальна вартість:',

  'build.skillOrder.title':     'Порядок умінь',
  'build.skillOrder.ariaLabel': 'Порядок умінь за рівнем',

  'anomaly.offMeta':  '{champion} off-meta ({requestedLane}) — показую мету ({naturalLane})',
  'anomaly.noData':   'Немає історичних даних для {champion} ({requestedLane}) — використано архетипний скоринг',

  'earlyComponent.tearRush': 'Купити першим — пасивка стакається з часом, чим раніше купиш Сльозу, тим сильнішим буде {item}.',

  'reason.armorVsAd':                     'Армор vs AD-команда ({percent}%)',
  'reason.mrVsAp':                        'MR vs AP-команда ({percent}%)',
  'reason.gwVsHealing':                   'Grievous Wounds vs хіл ворога',
  'reason.gwVsShields':                   'Grievous Wounds (знижений пріоритет — ворог тарчує {percent}%)',
  'reason.gwAllyCovered':                 'Grievous Wounds (союзник уже покриває — знижений пріоритет)',
  'reason.randuinVsCrit':                 'Randuin\'s vs крит ADC',
  'reason.resistVsTrue':                  'Опір > HP ({percent}% true/%HP шкода)',
  'reason.hpScalesWithTrue':              'HP скейлиться з %HP шкодою ворога (−{penalty})',
  'reason.armorPenCount':                 'Пробиття броні vs {count} танків',
  'reason.magicPenCount':                 'Магічне пробиття vs {count} танків',
  'reason.armorPen':                      'Пробиття броні vs танки',
  'reason.magicPen':                      'Магічне пробиття vs танки',
  'reason.hpVsAssassins':                 'HP vs {count} асасинів',
  'reason.defVsBurst':                    'Захист vs бурст ({count} чемпіонів)',
  'reason.tenacity':                      'Tenacity vs engage CC ({percent}%)',
  'reason.antiEngage':                    'Анти-engage vs dive ({percent}%)',
  'reason.antiPoke':                      'Анти-поук сустейн ({percent}%)',
  'reason.proMeta':                       'Про-мета {champion} ({rank}/{total})',
  'reason.goodItem':                      'Хороший предмет для {champion}',
  'reason.synergy.ardentFriendly':        'Синергія з {ally} (AS-керрі)',
  'reason.synergy.ardentUnfriendly':      'Слабко з {ally} (немає скейлу AS)',
  'reason.synergy.flowingWaterMediocre':  'Середньо з {ally}',
};

/** Master translation table — injected into TranslationService. */
export const TRANSLATIONS: Record<Lang, Dict> = { pl, en, de, es, ru, uk };
