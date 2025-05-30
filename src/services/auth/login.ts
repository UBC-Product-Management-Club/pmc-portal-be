import { auth } from "../../config/firebase"
import { loginResponse } from "./types"
import { checkUserExists } from "./utils"

/*
    Request Body must include:
        - user : User object returned from successful firebase authentication
        - idToken: idToken returned from successful firebase authentication. Used to exchange for session cookie
    HandleLogin authenticates idToken and returns a sessionCookie
*/
const handleLogin = async (userUID: string, idToken: string): Promise<loginResponse | undefined> => {
    if (!userUID || !idToken) {
        throw Error("400: Bad request")
    }

    // If user doesn't exist, return undefined
    if (!await checkUserExists(userUID)) {
        return undefined
    }

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
}

// Checks if the current userRef exists.
export { handleLogin }