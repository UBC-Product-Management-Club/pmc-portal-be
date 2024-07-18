import { UserRecord } from "firebase-admin/auth"

type registerReqBody = {
    uid: string // from google
    first_name: string
    last_name: string
    email: string // from google
    student_id: number
    year: number
    faculty: string
    major: string
    why_PM: string
    returning_member: boolean
}

type loginReqBody = {
    user: UserRecord
    idToken: string
}

export { registerReqBody, loginReqBody }