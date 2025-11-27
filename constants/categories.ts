export const CATEGORY_OPTIONS = [
  { id: 'fresh_produce', label: 'Fresh Produce' },
  { id: 'dairy_eggs', label: 'Dairy & Eggs' },
  { id: 'proteins', label: 'Proteins' },
  { id: 'seafood', label: 'Seafood' },
  { id: 'bakery', label: 'Bakery' },
  { id: 'pantry', label: 'Pantry Staples' },
  { id: 'spices_condiments', label: 'Spices & Condiments' },
  { id: 'frozen', label: 'Frozen' },
  { id: 'ready_meals', label: 'Ready Meals' },
  { id: 'beverages', label: 'Beverages' },
  { id: 'snacks', label: 'Snacks & Treats' },
  { id: 'baby', label: 'Baby' },
  { id: 'personal_care', label: 'Personal Care' },
  { id: 'household', label: 'Household' },
] as const;

export type InventoryCategory = (typeof CATEGORY_OPTIONS)[number]['id'];

export const getCategoryLabel = (category?: string | null) => {
  if (!category) return 'Pantry Staples';
  const match = CATEGORY_OPTIONS.find((option) => option.id === category);
  return match?.label ?? 'Pantry Staples';
};

