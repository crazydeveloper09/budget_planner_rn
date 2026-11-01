export const privacyUpdatedAt = "1 listopada 2026";

export const privacyIntro =
  "Niniejsza polityka wyjaśnia, jakie dane przetwarza aplikacja Budget Planner, w jakim celu i na jakiej podstawie — zarówno na telefonie, jak i w opcjonalnej chmurze.";

export const privacySections = [
  {
    title: "1. Administrator",
    paragraphs: [
      "Administratorem danych jest Maciej Solutions, Obrońców Pokoju 30B/30, 67-200 Głogów.",
      "Kontakt: budget.planner@maciejsolutions.pl.",
    ],
  },
  {
    title: "2. Co robi aplikacja",
    paragraphs: [
      "Budget Planner to planer budżetu (konto osobiste, rodzinne lub firmowe). Dane finansowe zapisujesz przede wszystkim lokalnie na urządzeniu (SQLite).",
      "Konto w chmurze jest opcjonalne. Służy do logowania, kopii zapasowej i — w budżecie rodzinnym oraz firmowym — zaproszeń oraz czatu.",
    ],
  },
  {
    title: "3. Dane na urządzeniu",
    paragraphs: [
      "Na telefonie mogą być m.in.: nazwa profilu, typ konta, członkowie, transakcje, paragony (zdjęcia), cele, czat, stan portfela i ustawienia (np. kolor, limit dzienny).",
      "Te dane nie wychodzą z urządzenia, dopóki nie zalogujesz się do chmury albo nie wyślesz paragonów na serwer.",
    ],
  },
  {
    title: "4. Konto i chmura",
    paragraphs: [
      "Przy rejestracji przetwarzamy login, skrót hasła, ewentualny kod 2FA (TOTP) oraz metadane gospodarstwa (np. nazwa konta, role).",
      "Treść budżetu (wpisy, kwoty, nazwy, czat) jest szyfrowana na urządzeniu (E2E, AES-256-GCM). Serwer przechowuje szyfrogram — bez odczytu kwot i nazw wpisów.",
      "Paragony mogą być wysyłane jako osobne, zaszyfrowane pliki powiązane z Twoim kontem.",
    ],
  },
  {
    title: "5. Powiadomienia",
    paragraphs: [
      "Jeśli włączysz powiadomienia, aplikacja może zapisać token push (Expo / FCM), żeby dostarczać np. wiadomości z czatu. Token nie jest używany do marketingu.",
    ],
  },
  {
    title: "6. Podstawy i cele",
    paragraphs: [
      "Świadczenie usługi (art. 6 ust. 1 lit. b RODO) — prowadzenie budżetu, konto, synchronizacja, zaproszenia.",
      "Uzasadniony interes (art. 6 ust. 1 lit. f RODO) — bezpieczeństwo (2FA, sesje), diagnostyka awarii, odpowiedź na zgłoszenia.",
      "Zgoda (art. 6 ust. 1 lit. a RODO) — tam, gdzie system wymaga zgody, np. aparat, galeria albo powiadomienia.",
    ],
  },
  {
    title: "7. Udostępnianie",
    paragraphs: [
      "Nie sprzedajemy danych. Korzystamy z infrastruktury potrzebnej do działania (hosting API i bazy, dostawa powiadomień). Dostawcy przetwarzają dane wyłącznie na nasze zlecenie.",
      "W budżecie rodzinnym lub firmowym inni zaproszeni członkowie widzą wspólny, odszyfrowany budżet na swoich urządzeniach — to cel tej funkcji.",
    ],
  },
  {
    title: "8. Czas przechowywania",
    paragraphs: [
      "Dane lokalne zostają do usunięcia aplikacji albo wyczyszczenia danych urządzenia.",
      "Konto w chmurze i kopia budżetu trwają, dopóki konto istnieje. Po usunięciu konta dane serwerowe usuwamy w zakresie, w jakim nie wymagają tego obowiązki prawne (np. logi bezpieczeństwa przez krótki czas).",
    ],
  },
  {
    title: "9. Twoje prawa",
    paragraphs: [
      "Przysługuje Ci dostęp, sprostowanie, usunięcie, ograniczenie, przeniesienie oraz sprzeciw — w zakresie wynikającym z RODO.",
      "Możesz też wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych (UODO).",
      "W sprawach konta napisz na budget.planner@maciejsolutions.pl.",
    ],
  },
  {
    title: "10. Młodzi użytkownicy",
    paragraphs: [
      "Budget Planner jest też dla osób poniżej 16. roku życia — nastolatki też mogą chcieć oszczędzać i pilnować wydatków.",
      "Korzystanie lokalne (bez konta w chmurze) zostaje na telefonie. Konto w chmurze osobom poniżej 16 lat zalecamy za zgodą rodzica albo opiekuna.",
      "Nie profilujemy młodych użytkowników w celach marketingowych.",
    ],
  },
  {
    title: "11. Kontakt",
    paragraphs: ["budget.planner@maciejsolutions.pl"],
  },
];
