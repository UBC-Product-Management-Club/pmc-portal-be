import { Router } from "express";
import { stripe } from "../../config/stripe";
import { Stripe } from "stripe";
import express from "express";
export const webhookRouter = Router();

webhookRouter.post("/", express.raw({ type: "application/json" }), async (req, res) => {
    try {
        const sig = req.headers["stripe-signature"] as string;
        const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);

        if (event.type === "customer.created") {
            const customer = event.data.object as Stripe.Customer;
            console.log("Customer created:", customer.id, customer.email);
        }

        res.status(200).send();
    } catch (error) {
        console.error("Webhook Error:", error);
        return res.status(400).send(`Webhook Error: ${error}`);
    }
});
