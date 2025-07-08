//  some are "| string" since FormData only accepts strings
type FirebaseEvent = {
    event_Id: string // generated
    name: string // from request
    date: string // Date in ISO format (e.g. YYYY-MM-DD)
    start_time: string // start time in ISO format (e.g. Thh:mm:ss)
    end_time: string // end time in ISO format (e.g. Thh:mm:ss)
    location: string // from request
    description: string // from request
    media: string[] // generated
    member_price: number | string// from request
    non_member_price: number | string // from request
    attendee_Ids: string[] | string
    member_only: boolean | string // from request
    maxAttendee: number
    eventFormId: string | undefined
    isDisabled: boolean // manually write default as "false" when adding new event
    points: Record<string, number>
}

type Attendee = {
    attendee_Id: string
    is_member: boolean
    member_Id: string
    event_Id: string
    first_name: string
    last_name: string
    student_id?: number
    email: string
    year?: number
    major?: string
    faculty?: string
    familiarity: 'beginner' | 'intermediate' | 'advanced' | 'mentor'
    found_out: string
    dietary: string
    event_form_answers: object | undefined
    files?: string[]
    activities_attended: string[]
    points: number
}

export type { FirebaseEvent, Attendee }
