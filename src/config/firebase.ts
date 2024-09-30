import dotenv from "dotenv"
import { cert, initializeApp, ServiceAccount } from "firebase-admin/app";
import serviceAccount from "../../.secret/pmc-portal-credential.json";
import { getAuth } from "firebase-admin/auth";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import { Storage } from "@google-cloud/storage"
import { Stripe } from "stripe"


dotenv.config({ path: "./.secret/.env" });

initializeApp({
  credential: cert(serviceAccount as ServiceAccount)
});

const auth = getAuth();
const db: Firestore = getFirestore(process.env.FIRESTORE_DATABASEB_ID!);
const storage = new Storage({
  keyFilename: ".secret/pmc-portal-credential.json"
})

console.log(process.env.STRIPE_SECRET)
const stripe = new Stripe(process.env.STRIPE_SECRET!)


export { auth, db, storage, stripe };
