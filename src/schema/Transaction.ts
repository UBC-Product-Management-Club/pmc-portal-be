
type paymentInfo = {
    id: string
    amount: number
    status: string
    created: number
}

type addTransactionBody = {
    type: "membership" | "event"
    member_id?: string
    attendee_id?: string
    payment: paymentInfo
}

export { paymentInfo, addTransactionBody }