import { cert, initializeApp, ServiceAccount } from "firebase-admin/app";
import serviceAccount from "../../.secret/pmc-portal-credential.json";
import { getAuth } from "firebase-admin/auth";
import { Firestore, getFirestore } from "firebase-admin/firestore";

initializeApp({
  credential: cert(serviceAccount as ServiceAccount)
});

const auth = getAuth();
const db: Firestore = getFirestore("pmc-portal-db");

export { auth, db };
