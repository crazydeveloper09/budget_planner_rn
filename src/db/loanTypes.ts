export type LoanPayment = {
  key: string;
  installment: number | null;
  date: string;
  amount: number;
  principal: number;
  interest: number;
  fees: number;
};

export type Loan = {
  id: string;
  name: string;
  kind: "credit" | "private";
  category?: string;
  contractTotalOnly?: boolean;
  principal: number;
  disbursedOn: string;
  firstDue: string;
  months: number;
  annualRate: number;
  rateChanges: Record<number, number>;
  installment: number | null;
  installmentOverrides: Record<number, number>;
  financedFee: number;
  upfrontFee: number;
  monthlyFee: number;
  payments: LoanPayment[];
  skipped: number[];
};

export type LoanInstallment = {
  number: number;
  date: string;
  amount: number;
  principal: number;
  interest: number;
  fees: number;
  payment?: LoanPayment;
  skipped: boolean;
};
