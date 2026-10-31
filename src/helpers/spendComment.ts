import { CategorySpend } from "./familyStats";
import { formatPln } from "./money";

const BY_CATEGORY: Record<string, string[]> = {
  Jedzenie: [
    "Lodówka miała ciężki miesiąc. Albo Ty przy lodówce.",
    "Gotowanie w domu to teoria. Paragony z jedzenia — praktyka.",
    "Dieta poszła spać. Portfel został na zmywaniu.",
  ],
  Transport: [
    "Albo bilety, albo aplikacja. Portfel i tak jedzie.",
    "Przejazdy zjadły budżet. Pieszo byłoby taniej, za to dłużej i z charakterem.",
    "Silnik albo silnik własnych nóg. W tym miesiącu wygrał ten pierwszy.",
  ],
  Mieszkanie: [
    "Czynsz nie żartuje. Ty też nie musisz.",
    "Dach nad głową ma swoją cenę. W tym miesiącu dał o sobie znać.",
    "Mieszkanie: najdroższy abonament, jaki masz. I nawet bez reklam.",
  ],
  Rachunki: [
    "Prąd, gaz i poczucie dorosłości w komplecie.",
    "Liczniki tykały, portfel kiwał z szacunkiem.",
    "Rachunki: ta kategoria, która nigdy nie idzie na promocję.",
  ],
  Zdrowie: [
    "Zdrowie drogie, ale tańsze niż jego brak. Podobno.",
    "Apteka i wizyty wzięły swoje. Trzymamy kciuki, że za to działa.",
    "Budżet poszedł w odporność. Reszta kategorii może poczekać w poczekalni.",
  ],
  Rozrywka: [
    "Netflix nie ogląda sam siebie. Przy tym rachunku powinien dokładać się do abonamentu.",
    "Małe przyjemności, wielki ślad w historii. Klasyka.",
    "Rozrywka wygrała miesiąc. Produktywność przysłała kondolencje.",
  ],
  Zakupy: [
    "Koszyk był niewinny. Do kasy.",
    "„Tylko coś drobnego” — mówi każdy paragon powyżej stu złotych.",
    "Zakupy wzięły podium. Szafa i szuflada biją brawo.",
  ],
  Edukacja: [
    "Inwestycja w mózg. Portfel kiwa z szacunkiem, choć trochę blady.",
    "Nauka kosztuje. Ignorancja też, tylko faktury przychodzą później.",
    "Książki, kursy, rozwój. Ten miesiąc miał ambitny plan.",
  ],
  Ubrania: [
    "Szafa pełna, a „nie mam się w co ubrać” żyje i ma się dobrze.",
    "Nowa kurtka / stare dylematy. Moda 1, budżet 0.",
    "Ubrania wygrały. Lustrzane selfie płaci rachunek.",
  ],
  Inne: [
    "Kategoria Inne: klasyczne „nie pamiętam, ale było trzeba”.",
    "Inne zjadło miesiąc. Detektyw budżetowy rozkłada ręce.",
    "To, czego nie dało się nazwać, i tak umie liczyć.",
  ],
};

function pick(list: string[], salt: number) {
  return list[Math.abs(salt) % list.length];
}

export function personalSpendComment(
  categories: CategorySpend[],
  totalExpenses: number,
  monthKey: string
): string {
  if (totalExpenses <= 0 || categories.length === 0) {
    return "Ten miesiąc jak poniedziałek bez kawy: cicho, tanio i trochę podejrzanie.";
  }

  const top = categories[0];
  const share = top.amount / totalExpenses;
  const salt = monthKey.split("").reduce((sum, char) => sum + char.charCodeAt(0), Math.round(top.amount));
  const base = pick(BY_CATEGORY[top.label] ?? BY_CATEGORY.Inne, salt);

  if (share >= 0.55) {
    return `${base} ${top.label} to ${Math.round(share * 100)}% wydatków (${formatPln(top.amount)}). Reszta kategorii może iść na kawę pocieszenia.`;
  }
  if (categories.length >= 2 && categories[1].amount > 0) {
    const second = categories[1];
    if (top.label === "Jedzenie" && second.label === "Rozrywka") {
      return "Jedzenie i rozrywka na czele. Przetrwanie plus serial. Reszta to detale.";
    }
    if (top.label === "Rozrywka" && second.label === "Jedzenie") {
      return "Najpierw klimat, potem kanapka. Portfel widział ten scenariusz.";
    }
    return `${base} Tuż za tym: ${second.label.toLowerCase()} (${formatPln(second.amount)}).`;
  }
  return `${base} Łącznie ${formatPln(totalExpenses)} — i tak to się ułożyło.`;
}
