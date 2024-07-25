
type userDocument = {
    first_name: string
    last_name: string
    email: string // from google
    displayName: string // from Google
    student_id: number
    year: string // "5+"
    faculty: string
    major: string
    why_PM: string
    returning_member: boolean
}

type onboardingReqBody = {
    creds: loginReqBody
    userDoc: userDocument
}

type loginReqBody = {
    userUID: string
    idToken: string
}

type loginResponse = {
    sessionCookie: string
    options: {
        maxAge: number
        httpOnly: boolean
        secure: boolean
    }
}

export { onboardingReqBody, loginReqBody, loginResponse, userDocument }