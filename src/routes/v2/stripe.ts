import { Router } from "express";
import { stripe } from "../../config/stripe";
import { supabase } from "../../config/supabase";
import { Stripe } from "stripe";
import express from "express";
import { Status } from "../../services/payments/PaymentService";

export const webhookRouter = Router();

webhookRouter.post("/", express.raw({ type: "application/json" }), async (req, res) => {
    try {
        const sig = req.headers["stripe-signature"] as string;
        const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);

        // responds 200 to stripe immediately
        res.status(200).send();

        // this allows the db to be handled in the background without delaying response to stripe (avoids retry from stripe)
        setImmediate(async () => {
            switch (event.type) {
                case "payment_intent.succeeded": {
                    const paymentIntent = event.data.object as Stripe.PaymentIntent;
                    const userId = paymentIntent.metadata?.user_id;
                    const paymentType = paymentIntent.metadata?.payment_type;

                    const { error } = await supabase.from("Payment").update({ status: Status.PAYMENT_SUCCESS }).eq("payment_id", paymentIntent.id);
                    if (error) {
                        console.error("Payment success update err:", error);
                    }

                    if (paymentType === "membership") {
                        const { error } = await supabase.from("User").update({ is_payment_verified: true }).eq("user_id", userId);
                        if (error) {
                            console.error("User verify update err:", error);
                        }

                        console.log(`Membership PaymentIntent for ${userId} succeeded: ${paymentIntent.id}`);
                    }

                    break;
                }

                case "payment_intent.canceled": {
                    break;
                }

                case "payment_intent.processing": {
                    break;
                }

                case "payment_intent.payment_failed": {
                    const paymentIntent = event.data.object as Stripe.PaymentIntent;
                    const userId = paymentIntent.metadata?.user_id;
                    const paymentType = paymentIntent.metadata?.payment_type;

                    if (paymentType === "membership") {
                        const { error } = await supabase.from("Payment").update({ status: Status.PAYMENT_FAILED }).eq("payment_id", paymentIntent.id);
                        if (error) {
                            console.error("Payment fail update err:", error);
                        }

                        console.log(`Membership PaymentIntent for ${userId} failed: ${paymentIntent.id}`);
                    }

                    break;
                }
                default:
                // console.log(`Unhandled event type ${event.type}`);
            }
        });
    } catch (error) {
        console.error("Webhook Error:", error);
        return res.status(400).send(`Webhook Error: ${error}`);
    }
});
