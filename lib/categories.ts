import categoriesData from "@/data/categories.json";

export interface Subcategory {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  subcategories: Subcategory[];
}

const categories = categoriesData as Category[];

export function getAllCategories(): Category[] {
  return categories;
}

export function getCategory(id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}

export function getSubcategory(id: string): Subcategory | undefined {
  for (const cat of categories) {
    const sub = cat.subcategories.find((s) => s.id === id);
    if (sub) return sub;
  }
  return undefined;
}

export function getSubcategories(categoryIds: string[]): Subcategory[] {
  return categories
    .filter((c) => categoryIds.includes(c.id))
    .flatMap((c) => c.subcategories);
}

export function getCategoryName(id: string): string {
  return getCategory(id)?.name ?? id;
}

export function getSubcategoryName(id: string): string {
  return getSubcategory(id)?.name ?? id;
}

export function getCategoryForSubcategory(subcategoryId: string): Category | undefined {
  return categories.find((c) =>
    c.subcategories.some((s) => s.id === subcategoryId),
  );
}

export function groupSubcategoriesByCategory(
  categoryIds: string[],
  subcategoryIds: string[],
): Array<{ category: Category; subcategories: Subcategory[] }> {
  return categories
    .filter((c) => categoryIds.includes(c.id))
    .map((c) => ({
      category: c,
      subcategories: c.subcategories.filter((s) => subcategoryIds.includes(s.id)),
    }))
    .filter((g) => g.subcategories.length > 0);
}
