import { cert, initializeApp, ServiceAccount } from "firebase-admin/app";
import serviceAccount from "../../.secret/pmc-portal-credential.json";
import { Auth, getAuth } from "firebase-admin/auth";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import { firestore } from "firebase-admin";

initializeApp({
  credential: cert(serviceAccount as ServiceAccount)
});

const auth: Auth = getAuth()
const db: Firestore = getFirestore("pmc-portal-db");

firestore.setLogFunction(console.log)

export { auth, db }
