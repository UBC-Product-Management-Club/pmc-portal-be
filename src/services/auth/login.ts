import { db } from "../../config/firebase"

// TODO: create types for user auth
const handleLogin = async (userId: string): Promise<any> => {
    if (!userId) {
        throw Error("400: Bad request")
    }
    try {
        const userRef = db.collection("users").doc(userId)
        const user = await userRef.get()
        return user.data()
    } catch (error) {
        throw Error("500: something went wrong fetching users")
    }
}

//supabase 
const handleSupabaseLogin = async (userUID: string, idToken: string): Promise<{message: string}> => {
   return {message: "success"}
}


// Checks if the current userRef exists.
export { handleLogin , handleSupabaseLogin}