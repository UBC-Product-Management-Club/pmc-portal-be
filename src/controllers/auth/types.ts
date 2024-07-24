import { UserRecord } from "firebase-admin/auth"

type registerReqBody = {
    member_Id: string
    first_name: string
    last_name: string
    email: string // get rid cuz there's Google
    student_id: number
    year: number
    faculty: string
    major: string
    why_PM: string // might change to drop down 
    returning_member: boolean
    attendee_ids: string[]
}

type loginReqBody = {
    user: UserRecord
    idToken: string
}

export { registerReqBody, loginReqBody }