import { createHash } from "node:crypto";

export type BrokerActivityFingerprintInput = {
  providerKey: string;
  externalAccountId: string;
  externalActivityId?: string | null;
  activityType: string;
  occurredAt?: string | null;
  externalInstrumentId?: string | null;
  quantity?: string | null;
  price?: string | null;
  grossAmount?: string | null;
  netAmount?: string | null;
  currency?: string | null;
};

export function brokerActivityFingerprint(input: BrokerActivityFingerprintInput): string {
  const identity = input.externalActivityId
    ? ["provider-id", input.providerKey, input.externalAccountId, input.externalActivityId]
    : [
        "facts-v1",
        input.providerKey,
        input.externalAccountId,
        input.activityType,
        input.occurredAt ?? "",
        input.externalInstrumentId ?? "",
        input.quantity ?? "",
        input.price ?? "",
        input.grossAmount ?? "",
        input.netAmount ?? "",
        input.currency ?? "",
      ];

  return createHash("sha256").update(identity.join("\u001f"), "utf8").digest("hex");
}
