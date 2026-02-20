import { Router } from "express";
import { stripe } from "../../config/stripe";
import express from "express";
import { handleStripeEvent } from "../../services/Payment/PaymentService";

export const webhookRouter = Router();

webhookRouter.post("/", express.raw({ type: "application/json" }), async (req, res) => {
    try {
        const sig = req.headers["stripe-signature"] as string;
        // const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
        const event = stripe.webhooks.constructEvent(req.body, sig, "whsec_26e2989099d5fa3a872f71edab23970d66d98da25227f3734bcf91ab459b04a1");

        // responds 200 to stripe immediately
        res.status(200).send();

        handleStripeEvent(event)
    } catch (error) {
        console.error("Webhook Error:", error);
        return res.status(400).send(`Webhook Error: ${error}`);
    }
});
