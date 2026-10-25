// One JSON line per notable event, so Cloud Run log-based alerts can match on it.
// Never put long answers, phone numbers or signed URLs in the details.
export type LoggedEvent =
  | "PAYMENT_REFUND_REQUIRED"
  | "REVIEW_RUN_FAILED"
  | "CAPACITY_INVARIANT_FAILED"
  | "EMAIL_SEND_FAILED"
  | "ATTENTION_REPLACED"
  | "UNKNOWN_CHECKOUT";

export const logEvent = (event: LoggedEvent, details: Record<string, string | number>) =>
  console.error(JSON.stringify({ event, ...details }));
