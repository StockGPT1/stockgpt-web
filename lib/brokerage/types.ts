export type BrokerConnectionStatus =
  | "pending"
  | "active"
  | "error"
  | "revoked"
  | "disconnected";

export type BrokerAccountStatus = "active" | "closed" | "inaccessible";

export type BrokerProvider = {
  id: string;
  providerKey: string;
  displayName: string;
};

export type BrokerageInstitution = {
  id: string;
  name: string;
  countryCode: string | null;
};

export type BrokerConnection = {
  id: string;
  userId: string;
  providerId: string;
  institutionId: string;
  externalConnectionId: string;
  status: BrokerConnectionStatus;
  lastAttemptedSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
};

export type BrokerAccount = {
  id: string;
  userId: string;
  connectionId: string;
  institutionId: string;
  externalAccountId: string;
  name: string;
  accountType: string | null;
  baseCurrency: string | null;
  status: BrokerAccountStatus;
};

export type BrokerPosition = {
  id: string;
  userId: string;
  accountId: string;
  positionKey: string;
  externalPositionId: string | null;
  externalInstrumentId: string | null;
  instrumentId: string | null;
  symbol: string | null;
  quantity: number;
  price: number | null;
  priceCurrency: string | null;
  marketValue: number | null;
  marketValueCurrency: string | null;
  asOf: string;
};

export type BrokerCashBalance = {
  id: string;
  userId: string;
  accountId: string;
  currency: string;
  amount: number;
  asOf: string;
};

export type BrokerActivity = {
  id: string;
  userId: string;
  accountId: string;
  instrumentId: string | null;
  externalActivityId: string | null;
  fingerprint: string;
  fingerprintVersion: string;
  activityType: string;
  occurredAt: string | null;
  recordedAt: string;
  quantity: number | null;
  price: number | null;
  grossAmount: number | null;
  netAmount: number | null;
  currency: string | null;
};
