import admin from "firebase-admin";
import serviceAccount from "../../.secret/pmc-portal-credential.json";
import { getAuth } from "firebase-admin/auth";
import { Firestore, getFirestore } from "firebase-admin/firestore";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

const auth = getAuth();
const db: Firestore = getFirestore("pmc-portal-db");

export { auth, db };
