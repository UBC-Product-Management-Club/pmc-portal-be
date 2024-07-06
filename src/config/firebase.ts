import admin from "firebase-admin";
import serviceAccount from "../../.secret/pmc-portal-credential.json";
import { getAuth } from "firebase-admin/auth";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

const auth = getAuth()
const db = admin.firestore();

export { auth, db }
