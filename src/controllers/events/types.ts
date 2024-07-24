
type Event = {
    event_Id: string
    name: string
    date: Date
    location: string
    description: string
    media: string[]
    price: number
    attendees: Attendee[]
    member_only: boolean
}

type Attendee = {
    attendee_Id: string
    is_member: boolean
    member_Id: string
    event_Id: string
}

export { Event, Attendee }