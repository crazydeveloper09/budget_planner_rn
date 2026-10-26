export interface IExpense {
    sum: number;
    category: string;
    type: "incomings" | "spendings"
}

export interface ISummary {
    date: string;
    expenses: IExpense[]
}