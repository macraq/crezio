/**
 * Typy domenowe zgodne z PRD i schematem DB (003_schema.sql)
 */

export type AccountType = 'influencer' | 'brand' | 'admin';

export type SubscriptionTier = 'basic' | 'medium' | 'platinum';

export type CampaignStatus = 'draft' | 'active' | 'applications_closed' | 'ended';

export type ApplicationStatus =
  | 'applied'
  | 'selected'
  | 'preparation_for_shipping'
  | 'publication'
  | 'completed';

export interface Profile {
  id: string;
  account_type: AccountType;
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  locale: string;
  created_at: string;
  updated_at: string;
}

export interface InfluencerProfile {
  profile_id: string;
  shipping_address_encrypted: string | null;
  category: string | null;
  location: string | null;
  followers_count: number | null;
  engagement_rate: number | null;
  /** Wzrost w cm (profil testera / beauty). */
  height_cm: number | null;
  hair_color: string | null;
  /** Rodzaj włosów (długość, faktura). */
  hair_style: string | null;
  skin_type: string | null;
  skin_notes: string | null;
  /** Swobodny opis o sobie — dopasowanie do oczekiń marki w teście (`Campaign.target_tester_description`). */
  self_description: string | null;
  social_links: Record<string, string>;
  profile_completion_pct: number;
  is_premium: boolean;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  profile_id: string;
  name: string;
  industry: string | null;
  contact: string | null;
  subscription_tier: SubscriptionTier;
  subscription_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Zgłoszenie influencera do kampanii. */
export interface CampaignApplication {
  id: string;
  campaign_id: string;
  influencer_id: string;
  status: ApplicationStatus;
  /** Tylko gdy influencer napisał dedykowany opis pod kampanię; `null` = użyto treści z profilu. */
  dedicated_self_description: string | null;
  /** Pełny tekst opisu w momencie wysłania zgłoszenia (z profilu lub dedykowany). */
  pitch_text_at_submit: string | null;
  brief: string | null;
  materials_from_brand: string | null;
  deadline: string | null;
  publication_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  brand_id: string;
  name: string;
  description: string | null;
  /** Kogo marka szuka w teście (np. osoby farbujące włosy) — dopasowanie AI / analiza. */
  target_tester_description: string | null;
  /** Podpowiedzi dla testerów jak pokazać produkt (widoczne publicznie); opcjonalne inspiracje. */
  presentation_inspiration: string | null;
  units_count: number;
  content_type: string;
  category: string | null;
  start_date: string;
  end_applications_date: string;
  end_date: string;
  status: CampaignStatus;
  auto_status_change: boolean;
  created_at: string;
  updated_at: string;
}

export const CAMPAIGN_LIMITS: Record<SubscriptionTier, number> = {
  basic: 1,
  medium: 3,
  platinum: 10,
};

/** Liczba produktów do wysyłki / testów w ramach abonamentu; `null` = bez limitu. */
export const TESTING_PRODUCT_LIMITS: Record<SubscriptionTier, number | null> = {
  basic: 5,
  medium: 20,
  platinum: null,
};

/** Sposób wyboru zgłoszonych influencerów do kampanii (do przyszłej logiki UI). */
export type InfluencerSelectionMode = 'ai_only' | 'hybrid_half' | 'manual_full';

export const INFLUENCER_SELECTION_BY_TIER: Record<SubscriptionTier, InfluencerSelectionMode> = {
  basic: 'ai_only',
  medium: 'hybrid_half',
  platinum: 'manual_full',
};

/** Poziom widoczności szczegółów profilu influencera (do przyszłej logiki UI). */
export type InfluencerDetailLevel = 'none' | 'basic_reach' | 'full';

export const INFLUENCER_DETAIL_LEVEL_BY_TIER: Record<SubscriptionTier, InfluencerDetailLevel> = {
  basic: 'none',
  medium: 'basic_reach',
  platinum: 'full',
};

export function canManuallySelectInfluencers(tier: SubscriptionTier): boolean {
  return INFLUENCER_SELECTION_BY_TIER[tier] !== 'ai_only';
}

export function maxManualSelections(tier: SubscriptionTier, unitsCount: number): number {
  const n = Math.max(0, Math.floor(Number.isFinite(unitsCount) ? unitsCount : 0));
  const mode = INFLUENCER_SELECTION_BY_TIER[tier];
  if (mode === 'ai_only') return 0;
  if (mode === 'hybrid_half') return Math.floor(n / 2);
  return n;
}
