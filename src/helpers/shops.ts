import AsyncStorage from "@react-native-async-storage/async-storage";
import { EXPENSE_CATEGORIES } from "./categories";

export type Shop = { name: string; category: string };

const catalog: Record<string, string[]> = {
  Jedzenie: ["Burger King", "Da Grasso", "Domino’s Pizza", "Green Caffè Nero", "Grycan", "KFC", "MAX Burgers", "McDonald’s", "North Fish", "Pasibus", "Pizza Hut", "Salad Story", "Sphinx", "Starbucks", "Subway", "Thai Wok"],
  Transport: ["Amic Energy", "BP", "Circle K", "MOL", "MOYA", "ORLEN", "Shell"],
  Mieszkanie: ["Agata", "Black Red White", "Castorama", "IKEA", "JYSK", "Leroy Merlin", "Merkury Market", "OBI", "PSB Mrówka"],
  Zdrowie: ["Apteka Gemini", "DOZ Apteka", "Dr.Max", "Super-Pharm", "Ziko Apteka"],
  Rozrywka: ["Cinema City", "Helios", "Kino Światowid", "Multikino"],
  Zakupy: ["Action", "Aldi", "Allegro", "Auchan", "Biedronka", "Carrefour", "Dealz", "Dino", "E.Leclerc", "Eurocash", "Hebe", "Intermarché", "Kaufland", "Lidl", "Media Expert", "MediaMarkt", "Netto", "Pepco", "Polomarket", "Rossmann", "RTV Euro AGD", "Stokrotka", "Żabka"],
  Edukacja: ["Bonito", "Empik", "Świat Książki", "Tania Książka"],
  Ubrania: ["CCC", "Cropp", "Deichmann", "eobuwie", "H&M", "House", "Mohito", "Reserved", "Sinsay", "TK Maxx", "Zalando", "Zara"],
};

const storageKey = (profileId: number) => `custom-shops:${profileId}`;

export async function readShops(profileId: number): Promise<Shop[]> {
  const saved = await AsyncStorage.getItem(storageKey(profileId));
  return saved ? JSON.parse(saved) : [];
}

function searchKey(value: string) {
  return value.toLocaleLowerCase("pl").normalize("NFD").replace(/\p{M}/gu, "").replace(/ł/g, "l");
}

export function shopGroups(custom: Shop[], query = "") {
  const search = searchKey(query.trim());
  return EXPENSE_CATEGORIES.map(({ label }) => ({
    category: label,
    names: [...new Map([...(catalog[label] ?? []), ...custom.filter(shop => shop.category === label).map(shop => shop.name)]
      .map(name => [name.toLocaleLowerCase("pl"), name])).values()]
      .filter(name => searchKey(name).includes(search) || searchKey(label).includes(search))
      .sort((a, b) => a.localeCompare(b, "pl")),
  })).filter(group => group.names.length > 0);
}

export function suggestShops(custom: Shop[], query: string): Shop[] {
  const search = searchKey(query.trim());
  if (!search) return [];
  const matches = shopGroups(custom).flatMap(({ category, names }) =>
    names.filter(name => searchKey(name).includes(search)).map(name => ({ name, category }))
  );
  return matches.sort((a, b) =>
    Number(searchKey(b.name).startsWith(search)) - Number(searchKey(a.name).startsWith(search)) ||
    a.name.localeCompare(b.name, "pl")
  ).slice(0, 5);
}

export async function addShop(profileId: number, input: Shop): Promise<Shop[]> {
  const name = input.name.trim();
  const category = input.category;
  if (!name || !EXPENSE_CATEGORIES.some(item => item.label === category)) {
    throw new Error("Podaj nazwę i kategorię sklepu.");
  }
  const custom = await readShops(profileId);
  const group = shopGroups(custom).find(item => item.category === category);
  if (group?.names.some(existing => existing.toLocaleLowerCase("pl") === name.toLocaleLowerCase("pl"))) {
    throw new Error("Ten sklep jest już na liście w tej kategorii.");
  }
  const next = [...custom, { name, category }];
  await AsyncStorage.setItem(storageKey(profileId), JSON.stringify(next));
  return next;
}
