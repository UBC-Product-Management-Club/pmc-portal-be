import { db } from "../../config/firebase";
import { User } from "../../schema/v1/User";
import { getSupabaseUserByID } from "../auth/users";

const getProfile = async (uid: string): Promise<User | undefined> => {
    const docRef = db.collection("users").doc(uid);
    const userRef = await docRef.get();
    return userRef.data() as User | undefined;
};

const getProfileByEmail = async (email: string): Promise<string | undefined> => {
    const userCollection = db.collection("users");
    const querySnapshot = await userCollection.where("email", "==", email).get();

    if (querySnapshot.empty) {
        return undefined;
    }

    const userDoc = querySnapshot.docs[0];
    return userDoc.id;
};

const getRegisteredEvents = async (uid: string): Promise<string[] | undefined> => {
    const attendeesRef = db.collection("attendees");
    const snapshot = await attendeesRef.where("member_Id", "==", uid).get();
    const eventIds = snapshot.docs.map((doc) => doc.data().event_Id);
    return eventIds;
};

// supabase services
const getSupabaseProfile = async (uid: string): Promise<User | undefined> => {
    try {
        const data = await getSupabaseUserByID(uid);
        return data as User | undefined;
    } catch (error) {
        console.error("Error finding user: ", error);
        throw error;
    }
};

export { getProfile, getProfileByEmail, getRegisteredEvents, getSupabaseProfile };
