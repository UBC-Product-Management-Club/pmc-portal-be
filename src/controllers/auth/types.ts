import { UserRecord } from "firebase-admin/auth"

type registerReqBody = {
    uid: string
    first_name: string
    last_name: string
    email: string
    student_id: number
    year: number
    faculty: string
    major: string
    why_PM: string
    returning_member: boolean
    attendee_ids: string[]
}

type loginReqBody = {
    user: UserRecord
    idToken: string
}

export { registerReqBody, loginReqBody }