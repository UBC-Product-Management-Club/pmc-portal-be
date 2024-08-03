
type Event = {
    event_Id: string
    name: string
    date: Date
    location: string
    description: string
    media: string[]
    member_price: number
    non_member_price: number
    attendees: Attendee[]
    member_only: boolean
}

type Attendee = {
    attendee_Id: string
    is_member: boolean
    member_Id: string
    event_Id: string
    first_name: string
    last_name: string
    student_num: number
    email: string
    year_level: number
    major: string
    faculty: string
    familiarity: 'beginner' | 'intermediate' | 'advanced' | 'mentor'
    found_out: string
    dietary: string
}

export { Event, Attendee }