import { Request, Response } from "express"
import { loginReqBody } from "./types"
import { auth, db } from "../../config/firebase"
import { UserRecord } from "firebase-admin/auth"
import { DocumentReference } from "firebase-admin/firestore"

/*
    Request Body must include:
        - user : User object returned from successful firebase authentication
        - idToken: idToken returned from successful firebase authentication. Used to exchange for session cookie
*/
const handleLogin = async (req: Request, res: Response) => {
    const { user, idToken }: loginReqBody = req.body
    const userRef: DocumentReference = db.collection('users').doc(user.uid)

    // FOR DEBUGGING
    // print({user, idToken})

    // check if user exists. If yes, redirect to /dashboard and return session_id. If no, go to /onboarding
    if (await checkUserExists(userRef)) {
        const expiresIn = 60 * 60 * 1000
        // return session_id then client should redirect to dashboard
        try {
            // exchanges idToken for session cookie
            // TODO:
            //  - Implement CSRF
            const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn })
            const options = { maxAge: expiresIn, httpOnly: true, secure: true}
            res.cookie('session', sessionCookie, options)
        } catch (error) {
            console.log(error);
            res.sendStatus(500)
        }
        res.sendStatus(200) // tells client to redirect to /dashboard
    } else {

        res.sendStatus(302) // tells client to redirect to /registration
    }
}

async function checkUserExists(userRef: DocumentReference) {
    const user = await userRef.get();
    return user.exists
}


// FOR DEGBUGGING
function print({user, idToken}: loginReqBody) {
    console.log(user.uid)
    console.log(user.displayName)
    console.log(user.email)
    console.log(user.photoURL)
    console.log(idToken)
}

export { handleLogin }