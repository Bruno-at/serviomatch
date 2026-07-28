export type PremiumTier = "free" | "pro";

interface PremiumState {
  isPremium: boolean;
  tier: PremiumTier;
  isDeveloper: boolean;
  loading: boolean;
}

/**
 * Subscriptions were removed — every feature is unlocked for all users.
 */
export const usePremium = (): PremiumState => ({
  isPremium: true,
  tier: "pro",
  isDeveloper: false,
  loading: false,
});
