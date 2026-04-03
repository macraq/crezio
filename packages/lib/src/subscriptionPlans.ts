import type { SubscriptionTier } from './types';
import { CAMPAIGN_LIMITS, TESTING_PRODUCT_LIMITS } from './types';

/** Kolejność kolumn w UI (Basic → Medium → Platinum). */
export const SUBSCRIPTION_PLANS_ORDER: readonly SubscriptionTier[] = [
  'basic',
  'medium',
  'platinum',
];

export interface SubscriptionPlanDefinition {
  id: SubscriptionTier;
  /** Krótka nazwa wyświetlana */
  label: string;
  shortDescription: string;
  /** Wyróżnienie wizualne (np. Medium jako rekomendowany). */
  highlighted: boolean;
  /** Tekst pod ceną — bez kwot, MVP kontaktowy. */
  pricingHint: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlanDefinition[] = [
  {
    id: 'basic',
    label: 'Basic',
    shortDescription:
      'Wejdź w influencer marketing bez tarcia: jedna kampania pilotażowa, inteligentny dobór twórców i pełna obsługa logistyczna — idealny start pod pierwszy test produktu.',
    highlighted: false,
    pricingHint: '1000 PLN/miesiąc',
  },
  {
    id: 'medium',
    label: 'Medium',
    shortDescription:
      'Skaluj barter z poczuciem kontroli: więcej kampanii równolegle, więcej produktów w obiegu i Ty decydujesz o połowie zestawu twórców — przy podglądzie kluczowych zasięgów.',
    highlighted: true,
    pricingHint: '3500 PLN/miesiąc',
  },
  {
    id: 'platinum',
    label: 'Platinum',
    shortDescription:
      'Pełna swoboda dla marek, które żyją kampaniami: bez limitu produktów testowych, ręczna selekcja influencerów i bogaty podgląd profili — jak w narzędziu do recruitmentu twórców.',
    highlighted: false,
    pricingHint: '<a href="mailto:kontakt@crezio.pl">Kontaktuj się z nami</a>',
  },
];

export type ComparisonCellValue = boolean | string | number;

export interface SubscriptionComparisonRow {
  id: string;
  label: string;
  values: Record<SubscriptionTier, ComparisonCellValue>;
}

/** Etykiety PL — dopasowane do INFLUENCER_SELECTION_BY_TIER w types.ts. */
const INFLUENCER_SELECTION_LABEL_PL: Record<SubscriptionTier, string> = {
  basic: 'Smart matching AI — Ty zatwierdzasz brief, resztą zajmuje się platforma',
  medium: 'Hybryda: do 50% zestawu dobierasz ręcznie, reszta przez AI',
  platinum: 'Pełna kontrola: każdy twórca wybrany przez Twój zespół',
};

/** Etykiety PL — dopasowane do INFLUENCER_DETAIL_LEVEL_BY_TIER w types.ts. */
const INFLUENCER_DETAIL_LABEL_PL: Record<SubscriptionTier, string> = {
  basic: 'Niedostępny — decyzje oparte na danych zgłoszenia',
  medium: 'Insight pod decyzję: followers, ER i kluczowe metryki zasięgu',
  platinum: 'Pełny profil: zasięgi, demografia, historia współprac i więcej',
};

export function formatTestingProductLimit(tier: SubscriptionTier): string {
  const n = TESTING_PRODUCT_LIMITS[tier];
  return n === null ? 'Nielimitowane' : String(n);
}

const INCLUDED_ALL: Record<SubscriptionTier, string> = {
  basic: 'W pakiecie',
  medium: 'W pakiecie',
  platinum: 'W pakiecie',
};

/**
 * Wiersze macierzy — kolejność: limit kampanii → funkcje wspólne → różnice między pakietami.
 * Limity równoległych kampanii: CAMPAIGN_LIMITS + trigger w DB.
 */
export const SUBSCRIPTION_COMPARISON_ROWS: SubscriptionComparisonRow[] = [
  {
    id: 'parallel_campaigns',
    label: 'Ile barterów prowadzisz jednocześnie (limit pakietu)',
    values: {
      basic: CAMPAIGN_LIMITS.basic,
      medium: CAMPAIGN_LIMITS.medium,
      platinum: CAMPAIGN_LIMITS.platinum,
    },
  },
  {
    id: 'dashboard',
    label: 'Dashboard kampanii — jeden ekran ze statusami, limitami pakietu i postępem',
    values: { ...INCLUDED_ALL },
  },
  {
    id: 'applications',
    label: 'Zgłoszenia influencerów — lista, filtry i shortlista gotowa do działania',
    values: { ...INCLUDED_ALL },
  },
  {
    id: 'shipping_status',
    label: 'Śledzenie wysyłki i realizacji — od paczki po publikację',
    values: { ...INCLUDED_ALL },
  },
  {
    id: 'pdf_report',
    label: 'Raport końcowy PDF — zasięgi, najmocniejsze treści i podsumowanie kampanii',
    values: { ...INCLUDED_ALL },
  },
  {
    id: 'testing_products',
    label: 'Produkty wysłane do testów — skala logistyki w ramach abonamentu',
    values: {
      basic: formatTestingProductLimit('basic'),
      medium: formatTestingProductLimit('medium'),
      platinum: formatTestingProductLimit('platinum'),
    },
  },
  {
    id: 'influencer_selection',
    label: 'Selekcja influencerów po zgłoszeniach — AI, Ty, albo oboje',
    values: {
      basic: INFLUENCER_SELECTION_LABEL_PL.basic,
      medium: INFLUENCER_SELECTION_LABEL_PL.medium,
      platinum: INFLUENCER_SELECTION_LABEL_PL.platinum,
    },
  },
  {
    id: 'influencer_detail_view',
    label: 'Podgląd profilu twórcy — ile widzisz przed decyzją',
    values: {
      basic: INFLUENCER_DETAIL_LABEL_PL.basic,
      medium: INFLUENCER_DETAIL_LABEL_PL.medium,
      platinum: INFLUENCER_DETAIL_LABEL_PL.platinum,
    },
  },
];

export function tierLabel(tier: SubscriptionTier): string {
  return SUBSCRIPTION_PLANS.find((p) => p.id === tier)?.label ?? tier;
}
