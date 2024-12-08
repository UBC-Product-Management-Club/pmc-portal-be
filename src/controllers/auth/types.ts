
type userDocument = {
    first_name: string
    last_name: string
    pronouns: string
    email: string // from google
    displayName: string // from Google
    university: string
    student_id: number
    year: string // "5+"
    faculty: string
    major: string
    why_PM: string
    returning_member: boolean
    attendee_ids: string[]
    paymentVerified?: boolean
}

type memberOnboardingInfo = {
    creds: loginReqBody
    userDoc: userDocument
}

type paymentInfo = {
  id: string;
  amount: number;
  status: string;
  created: number;
};

type membershipPaymentInfo = {
  type: "membership";
  member_id?: string;
  attendee_id?: string;
  payment: paymentInfo;
}

type onboardingReqBody = {
    onboardingInfo: memberOnboardingInfo
    paymentInfo: membershipPaymentInfo
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

export { onboardingReqBody, loginReqBody, loginResponse, userDocument, memberOnboardingInfo }