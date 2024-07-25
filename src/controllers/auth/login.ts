import { auth } from "../../config/firebase"
import { loginResponse } from "./types"
import { checkUserExists } from "./utils"

/*
    Request Body must include:
        - user : User object returned from successful firebase authentication
        - idToken: idToken returned from successful firebase authentication. Used to exchange for session cookie
    HandleLogin authenticates idToken and returns a sessionCookie
*/
const handleLogin = async (userUID: string, idToken: string): Promise<loginResponse> => {
    if (!userUID || !idToken) {
        throw Error("400: Bad request")
    }
    // check if user exists. If yes, redirect to /dashboard and return session_id. If no, go to /onboarding
    // if (await checkUserExists(userUID)) {
        const expiresIn = 60 * 60 * 1000
        try {
            // exchanges idToken for session cookie
            const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn })
            const options = { maxAge: expiresIn, httpOnly: true, secure: true}
            return { sessionCookie: sessionCookie, options: options }
            // res.cookie('session', sessionCookie, options)
        } catch (error) {
            // Failed session cookie creation
            throw Error("500: Failed to create session cookie")
        }
    // } else {
    //     // Non-existent user tried to call login endpoint,
    //     throw Error("400: Unauthorized access")
    // }
}

// Checks if the current userRef exists.
export { handleLogin }