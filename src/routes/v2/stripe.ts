import { Router } from "express";
import { stripe } from "../../config/stripe";
import { supabase } from "../../config/supabase";
import { Stripe } from "stripe";
import express from "express";
import { handleStripeEvent } from "../../services/payments/PaymentService";

export const webhookRouter = Router();

webhookRouter.post("/", express.raw({ type: "application/json" }), async (req, res) => {
    try {
        const sig = req.headers["stripe-signature"] as string;
        const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);

        // responds 200 to stripe immediately
        res.status(200).send();

        handleStripeEvent(event).catch((error) => {
            console.error("Error handling Stripe event:", error);
        });
    } catch (error) {
        console.error("Webhook Error:", error);
        return res.status(400).send(`Webhook Error: ${error}`);
    }
});
