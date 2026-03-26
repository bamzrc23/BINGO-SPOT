export type AuthorizedBankAccount = {
  bankName: string;
  accountType: "Ahorros" | "Corriente";
  accountNumber: string;
};

export type TopupAccountHolder = {
  fullName: string;
  documentLabel: string;
  documentNumber: string;
};

export const AUTHORIZED_TOPUP_BANK_ACCOUNTS: AuthorizedBankAccount[] = [
  {
    bankName: "Banco Pichincha",
    accountType: "Ahorros",
    accountNumber: "2205616228"
  },
  {
    bankName: "Banco Guayaquil",
    accountType: "Ahorros",
    accountNumber: "0025712981"
  }
];

export const TOPUP_ACCOUNT_HOLDER: TopupAccountHolder = {
  fullName: "Bryan Matailo",
  documentLabel: "DNI",
  documentNumber: "0750183469"
};

export const TOPUP_ACCREDITATION_WINDOW_TEXT = "5 a 20 minutos";
