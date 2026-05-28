export interface PremiumUser {
  plan?: string
  subscriptionStatus?: string
  planExpiresAt?: string | Date | null
}

/**
 * Validates whether the user qualifies for Premium features
 */
export function isPremium(user?: PremiumUser | null): boolean {
  if (!user) return false
  
  const hasPremiumPlan = user.plan === 'premium'
  const isStatusValid = user.subscriptionStatus === 'active' || user.subscriptionStatus === 'cancelled'
  
  if (hasPremiumPlan && isStatusValid) {
    if (user.planExpiresAt) {
      const expirationDate = new Date(user.planExpiresAt)
      return expirationDate.getTime() > Date.now()
    }
    return true // No expiration means permanent premium (e.g. lifetime plan / manual admin grant)
  }
  
  return false
}

/**
 * Returns the human-readable description of the user plan
 */
export function getUserPlan(user?: PremiumUser | null): 'Free Tier' | 'Premium Member' {
  return isPremium(user) ? 'Premium Member' : 'Free Tier'
}
