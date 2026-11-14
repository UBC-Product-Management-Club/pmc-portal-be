jest.mock("../../src/middleware/Session", () => ({
  authenticated: [
    (req: any, _res: any, next: any) => {
      req.user = { user_id: "user-123" };
      next();
    },
  ],
}));
jest.mock("../../src/services/Event/EventService");
jest.mock("../../src/services/Attendee/AttendeeService");
jest.mock("../../src/services/User/UserService");
jest.mock("../../src/services/Email/EmailService", () => ({ addToMailingList: jest.fn() }));
jest.mock("../../src/services/Payment/PaymentService");

import express from "express";
import request from "supertest";
import { paymentRouter } from "../../src/routes/v2/payments";
import { getEvent, getEventPriceId } from "../../src/services/Event/EventService";
import { getAttendee, registerIfSeatAvailable } from "../../src/services/Attendee/AttendeeService";
import { getUser } from "../../src/services/User/UserService";
import {
  getOrCreateEventCheckoutSession,
  getOrCreateRSVPCheckoutSession,
} from "../../src/services/Payment/PaymentService";

const app = express();
app.use(express.json());
app.use("/payments", paymentRouter);

const reviewed = { event_id: "event-456", needs_review: true };
const inAnHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

beforeEach(() => {
  process.env.ORIGIN = "https://portal.example";
  (getUser as jest.Mock).mockResolvedValue({ is_payment_verified: false });
  (getEvent as jest.Mock).mockResolvedValue(reviewed);
  (registerIfSeatAvailable as jest.Mock).mockResolvedValue(true);
});

describe("GET /payments/checkout-session/event/:eventId", () => {
  it("RSVPs an accepted student on a free event and sends them back to the event page", async () => {
    (getAttendee as jest.Mock).mockResolvedValue({ attendee_id: "att-1", status: "ACCEPTED", payment_due_at: inAnHour() });
    (getEventPriceId as jest.Mock).mockResolvedValue(null);

    const res = await request(app).get("/payments/checkout-session/event/event-456");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ url: "https://portal.example/events/event-456" });
    expect(registerIfSeatAvailable).toHaveBeenCalledWith("att-1");
    expect(getOrCreateEventCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses an RSVP once the window that held the seat has closed", async () => {
    (getAttendee as jest.Mock).mockResolvedValue({
      attendee_id: "att-1",
      status: "ACCEPTED",
      payment_due_at: new Date(Date.now() - 1000).toISOString(),
    });
    (getEventPriceId as jest.Mock).mockResolvedValue(null);

    const res = await request(app).get("/payments/checkout-session/event/event-456");

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("HOLD_EXPIRED");
    expect(registerIfSeatAvailable).not.toHaveBeenCalled();
  });

  it("never registers a student who hasn't been accepted, even when free", async () => {
    (getAttendee as jest.Mock).mockResolvedValue({ attendee_id: "att-1", status: "APPLIED" });
    (getEventPriceId as jest.Mock).mockResolvedValue("");

    const res = await request(app).get("/payments/checkout-session/event/event-456");

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("NOT_ACCEPTED");
    expect(registerIfSeatAvailable).not.toHaveBeenCalled();
  });

  it("still sends a paid student to Stripe", async () => {
    (getAttendee as jest.Mock).mockResolvedValue({ attendee_id: "att-1", status: "ACCEPTED" });
    (getEventPriceId as jest.Mock).mockResolvedValue("price_n");
    (getOrCreateEventCheckoutSession as jest.Mock).mockResolvedValue({ url: "https://stripe" });

    const res = await request(app).get("/payments/checkout-session/event/event-456");

    expect(res.body).toEqual({ url: "https://stripe" });
    expect(registerIfSeatAvailable).not.toHaveBeenCalled();
  });
});

describe("GET /payments/checkout-session/rsvp/:eventId", () => {
  it("refuses reviewed events, so applying can't skip the review", async () => {
    (getAttendee as jest.Mock).mockResolvedValue({ attendee_id: "att-1", status: "APPLIED" });
    (getEventPriceId as jest.Mock).mockResolvedValue(null);

    const res = await request(app).get("/payments/checkout-session/rsvp/event-456");

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("NOT_ACCEPTED");
    expect(registerIfSeatAvailable).not.toHaveBeenCalled();
    expect(getOrCreateRSVPCheckoutSession).not.toHaveBeenCalled();
  });

  it("still registers a student for a free event without review", async () => {
    (getEvent as jest.Mock).mockResolvedValue({ ...reviewed, needs_review: false });
    (getAttendee as jest.Mock).mockResolvedValue({ attendee_id: "att-1", status: "PROCESSING" });
    (getEventPriceId as jest.Mock).mockResolvedValue(null);

    const res = await request(app).get("/payments/checkout-session/rsvp/event-456");

    expect(res.status).toBe(200);
    expect(registerIfSeatAvailable).toHaveBeenCalledWith("att-1");
  });
});
