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
