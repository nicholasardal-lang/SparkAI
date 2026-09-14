export const plans = [
  { id: "starter", name: "Starter", monthly: 12, yearly: 120, credits: 1200, description: "A home for your first big idea." },
  { id: "creator", name: "Creator", monthly: 24, yearly: 240, credits: 3500, description: "More room to build, test, and refine." },
  { id: "pro", name: "Pro", monthly: 49, yearly: 490, credits: 8000, description: "For creators with plenty in the works." },
] as const;
export const creditPacks = [
  { name: "Small", price: 5, credits: 600 },
  { name: "Builder", price: 10, credits: 1400 },
  { name: "Studio", price: 20, credits: 3200 },
] as const;

// Stripe sandbox Price IDs are public identifiers. Secret keys stay in hosting settings.
export const stripePrices = {
  starter: { monthly: "price_1UFeGEA98x23KT8UKb0v9mj9", yearly: "price_1UFeJpA98x23KT8UuMBI33Xa" },
  creator: { monthly: "price_1UFeKVA98x23KT8UoyqRdstJ", yearly: "price_1UFeKrA98x23KT8U47QdRTL7" },
  pro: { monthly: "price_1UFeLMA98x23KT8UoKFfC8Fs", yearly: "price_1UFeLeA98x23KT8U3zcuiV0A" },
  packs: {
    Small: "price_1UFeMQA98x23KT8UQdK4S8l2",
    Builder: "price_1UFeMkA98x23KT8Un4x858AT",
    Studio: "price_1UFeN2A98x23KT8U0r0X95Kr",
  },
} as const;
