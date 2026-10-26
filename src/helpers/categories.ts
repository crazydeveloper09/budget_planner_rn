import { TransactionType } from "../db/interfaces";

export type CategoryOption = {
  label: string;
  icon: keyof typeof import("@expo/vector-icons/MaterialCommunityIcons").default.glyphMap;
  tint: string;
};

export const EXPENSE_CATEGORIES: CategoryOption[] = [
  { label: "Jedzenie", icon: "food", tint: "#E8A87C" },
  { label: "Transport", icon: "bus", tint: "#6C9BCF" },
  { label: "Mieszkanie", icon: "home-outline", tint: "#8E7CC3" },
  { label: "Rachunki", icon: "flash-outline", tint: "#E6B422" },
  { label: "Zdrowie", icon: "heart-pulse", tint: "#D36B6B" },
  { label: "Rozrywka", icon: "movie-open-outline", tint: "#C06C84" },
  { label: "Zakupy", icon: "shopping-outline", tint: "#7D9D7A" },
  { label: "Edukacja", icon: "school-outline", tint: "#5B8A9A" },
  { label: "Ubrania", icon: "tshirt-crew-outline", tint: "#C97BA8" },
  { label: "Inne", icon: "dots-horizontal-circle-outline", tint: "#8A7A88" },
];

export const INCOME_CATEGORIES: CategoryOption[] = [
  { label: "Wypłata", icon: "briefcase-outline", tint: "#5B8A72" },
  { label: "Premia", icon: "star-outline", tint: "#D4A017" },
  { label: "Prezent", icon: "gift-outline", tint: "#C06C84" },
  { label: "Zwrot", icon: "cash-refund", tint: "#6C9BCF" },
  { label: "Inwestycje", icon: "chart-line", tint: "#8E7CC3" },
  { label: "Inne", icon: "dots-horizontal-circle-outline", tint: "#8A7A88" },
];

export function categoriesFor(type: TransactionType): CategoryOption[] {
  return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function getCategoryOption(label: string, type: TransactionType): CategoryOption | undefined {
  return categoriesFor(type).find((item) => item.label === label);
}
