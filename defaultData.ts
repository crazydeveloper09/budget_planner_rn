import { ISummary } from "./src/contexts/interfaces";

export const months = [
    "Styczeń",
    "Luty",
    "Marzec",
    "Kwiecień",
    "Maj",
    "Czerwiec",
    "Lipiec",
    "Sierpień",
    "Wrzesień",
    "Październik",
    "Listopad",
    "Grudzień"
];

export const weekdays = [
    "Pn",
    "Wt",
    "Śr",
    "Czw",
    "Pt",
    "So",
    "Nd"
]

export const summary: ISummary[] = [
  {
    date: "20.08.2025",
    expenses: [
      {
        type: "spendings",
        category: "Jedzenie",
        sum: 60.0,
      },
      {
        type: "spendings",
        category: "Premia",
        sum: 40.0,
      },
    ], // saldo = 100 zł
  },
  {
    date: "21.08.2025",
    expenses: [
      {
        type: "spendings",
        category: "Zakupy",
        sum: 120.0,
      },
      {
        type: "spendings",
        category: "Transport",
        sum: 30.0,
      },
    ], // saldo = 150 zł > 100 zł
  },
  {
    date: "22.08.2025",
    expenses: [
      {
        type: "spendings",
        category: "Kawa",
        sum: 15.0,
      },
      {
        type: "spendings",
        category: "Bilety",
        sum: 20.0,
      },
    ], // saldo = 35 zł < 100 zł
  },
];
