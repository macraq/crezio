/**
 * Wagi zgodne z PRD (US-007): kompletny profil zwiększa szanse na dopasowanie do kampanii.
 * Uwzględnia też dane testera (beauty): wzrost, włosy, skóra.
 */

export type SocialLinksState = Record<string, string>;

export interface InfluencerProfileCompletionInput {
  category: string | null;
  location: string | null;
  followersCount: number | null;
  shippingAddress: string | null;
  socialLinks: SocialLinksState;
  engagementRate: number | null;
  heightCm: number | null;
  hairColor: string | null;
  hairStyle: string | null;
  skinType: string | null;
  skinNotes: string | null;
  selfDescription: string | null;
}

/** Suma wag = 100 — core kampanii + segment „profil testera”. */
const WEIGHTS = {
  category: 12,
  location: 12,
  followers: 13,
  shipping: 18,
  social: 15,
  engagement: 10,
  heightCm: 3,
  hairColor: 3,
  hairStyle: 3,
  skinType: 3,
  skinNotes: 3,
  selfDescription: 5,
} as const;

function hasAnySocialLink(links: SocialLinksState): boolean {
  return Object.values(links).some((v) => (v ?? '').trim().length > 0);
}

export function computeInfluencerProfileCompletion(input: InfluencerProfileCompletionInput): number {
  let pct = 0;
  if ((input.category ?? '').trim()) pct += WEIGHTS.category;
  if ((input.location ?? '').trim()) pct += WEIGHTS.location;
  if (input.followersCount != null && input.followersCount >= 0) pct += WEIGHTS.followers;
  if ((input.shippingAddress ?? '').trim()) pct += WEIGHTS.shipping;
  if (hasAnySocialLink(input.socialLinks)) pct += WEIGHTS.social;
  if (input.engagementRate != null && input.engagementRate >= 0 && input.engagementRate <= 1) {
    pct += WEIGHTS.engagement;
  }
  if (input.heightCm != null && input.heightCm >= 120 && input.heightCm <= 230) {
    pct += WEIGHTS.heightCm;
  }
  if ((input.hairColor ?? '').trim()) pct += WEIGHTS.hairColor;
  if ((input.hairStyle ?? '').trim()) pct += WEIGHTS.hairStyle;
  if ((input.skinType ?? '').trim()) pct += WEIGHTS.skinType;
  if ((input.skinNotes ?? '').trim()) pct += WEIGHTS.skinNotes;
  if ((input.selfDescription ?? '').trim()) pct += WEIGHTS.selfDescription;
  return Math.min(100, Math.round(pct));
}
