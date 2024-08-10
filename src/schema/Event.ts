
type Event = {
    event_Id: string // generated
    name: string // from request
    date: Date // from request
    location: string // from request
    description: string // from request
    media: string[] // generated
    member_price: number // from request
    non_member_price: number // from request
    attendee_Ids: string[] 
    member_only: boolean // from request
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


export type { Event, Attendee }