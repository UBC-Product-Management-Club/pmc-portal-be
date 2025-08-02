import { Router } from "express";
import { stripe } from "../../config/stripe";
import { Stripe } from "stripe";
import express from "express";

export const webhookRouter = Router();

webhookRouter.post("/", express.raw({ type: "application/json" }), (req, res) => {
    try {
        const sig = req.headers["stripe-signature"] as string;
        const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);

        if (event.type === "payment_intent.succeeded") {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            console.log("Payment intent succeeded:", paymentIntent.id, paymentIntent.amount, paymentIntent.currency, paymentIntent.status, paymentIntent.payment_method);
        }

        if (event.type === "payment_intent.processing") {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            console.log("Payment intent processing:", paymentIntent.id, paymentIntent.amount, paymentIntent.currency, paymentIntent.status, paymentIntent.payment_method);
        }

        if (event.type === "payment_intent.canceled") {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            console.log("Payment intent canceled:", paymentIntent.id, paymentIntent.amount, paymentIntent.currency, paymentIntent.status, paymentIntent.payment_method);
        }

        res.status(200).send();
    } catch (error) {
        console.error("Webhook Error:", error);
        return res.status(400).send(`Webhook Error: ${error}`);
    }
});
