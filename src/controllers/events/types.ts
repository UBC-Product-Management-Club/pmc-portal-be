
type Event = {
    event_Id: string
    name: string
    date: Date
    location: string
    description: string
    media: string[]
    price: number
    attendees: string[]
    member_only: boolean
}

export { Event }