import { Timestamp } from "firebase-admin/firestore"

interface User {
    displayName: string
    email: string
    faculty: string
    first_name: string
    last_name: string
    year: number
    major: string
    pfp: string
    student_id: number
    why_pm: string
    returning_member: boolean
    date_joined: Timestamp
}

export type { User }