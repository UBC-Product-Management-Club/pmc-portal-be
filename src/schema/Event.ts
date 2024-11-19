//  some are "| string" since FormData only accepts strings
type Event = {
    event_Id: string // generated
    name: string // from request
    date: Date | string // from request. We should standardize a date format.
    location: string // from request
    description: string // from request
    media: string[] // generated
    member_price: number | string// from request
    non_member_price: number | string // from request
    attendee_Ids: string[] | string
    member_only: boolean | string // from request
    maxAttendee: number
    eventForm: string | undefined
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
    event_form_answers: object | undefined
}


export type {Event, Attendee}