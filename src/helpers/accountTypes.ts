import { AccountType } from "../db/interfaces";

export const ACCOUNT_TYPES: {
  type: AccountType;
  title: string;
  description: string;
  icon: "account" | "office-building" | "home-heart";
  nameLabel: string;
  namePlaceholder: string;
}[] = [
  {
    type: "personal",
    title: "Konto osobiste",
    description: "Twój prywatny budżet",
    icon: "account",
    nameLabel: "Imię",
    namePlaceholder: "np. Ania",
  },
  {
    type: "business",
    title: "Konto firmowe",
    description: "Finanse firmy w jednym miejscu",
    icon: "office-building",
    nameLabel: "Nazwa firmy",
    namePlaceholder: "np. Studio Kwiaty",
  },
  {
    type: "family",
    title: "Konto rodzinne",
    description: "Wspólny budżet domowy",
    icon: "home-heart",
    nameLabel: "Nazwa rodziny",
    namePlaceholder: "np. Rodzina Nowaków",
  },
];

export function getAccountTypeConfig(type: AccountType) {
  return ACCOUNT_TYPES.find((item) => item.type === type) ?? ACCOUNT_TYPES[0];
}
