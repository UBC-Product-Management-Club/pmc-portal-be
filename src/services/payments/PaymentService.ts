import { stripe } from "../../config/firebase"

// in cents
const MEMBERSHIP_FEE_UBC = 1067
const MEMBERSHIP_FEE_NONUBC = 1567

async function createMembershipPaymentIntent(isUbc: boolean) {
    return await stripe.paymentIntents.create({
        amount: isUbc ? MEMBERSHIP_FEE_UBC : MEMBERSHIP_FEE_NONUBC,
        currency: 'cad'
    })
}

async function createEventPaymentIntent(eventId: string) {

}

export { MEMBERSHIP_FEE_UBC, MEMBERSHIP_FEE_NONUBC, createMembershipPaymentIntent}