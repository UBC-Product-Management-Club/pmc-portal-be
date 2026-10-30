import { Tables } from "../../schema/v2/database.types";

// What the event page shows for an application, worked out here so the portal
// never derives it. DRAFT is the frontend's own state: no attendee row yet.
export type WorkflowState =
  | "UNDER_REVIEW"
  | "PAYMENT_WINDOW_OPEN"
  | "PAYMENT_WINDOW_PASSED"
  | "PAYMENT_PROCESSING"
  | "REGISTERED"
  | "NOT_SELECTED";

// paymentSeen: the student is back from a Stripe checkout that's paid but the
// webhook hasn't registered them yet
export const workflowState = (
  attendee: Pick<Tables<"Attendee">, "status" | "payment_due_at">,
  now: Date,
  paymentSeen = false
): WorkflowState | null => {
  switch (attendee.status) {
    case "APPLIED":
      return "UNDER_REVIEW";
    case "ACCEPTED":
      if (paymentSeen) return "PAYMENT_PROCESSING";
      // The window is open until payment_due_at, not through it
      return attendee.payment_due_at && now >= new Date(attendee.payment_due_at)
        ? "PAYMENT_WINDOW_PASSED"
        : "PAYMENT_WINDOW_OPEN";
    case "PROCESSING":
      return "PAYMENT_PROCESSING";
    case "REGISTERED":
      return "REGISTERED";
    // FAILED: an event without review filled before the payment landed
    case "REJECTED":
    case "FAILED":
      return "NOT_SELECTED";
    default:
      return null;
  }
};
