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

export interface Campaign {
  id: string;
  brand_id: string;
  name: string;
  description: string | null;
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
