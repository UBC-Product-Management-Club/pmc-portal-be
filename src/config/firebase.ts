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
console.log("Database ID: ", process.env.FIRESTORE_DATABASE_ID!)
const auth = getAuth();
const db: Firestore = getFirestore(process.env.FIRESTORE_DATABASE_ID!);
const storage = new Storage({
  keyFilename: "/.secret/pmc-portal-credential.json"
})

console.log(process.env.STRIPE_SECRET)
const stripe = new Stripe(process.env.STRIPE_SECRET!)

console.log("Current working directory:", process.cwd());
console.log("Attempting to use keyfile at:", process.cwd() + "/.secret/pmc-portal-credential.json");

// Add debug logging to verify file existence
const fs = require('fs');
console.log("Checking if credential file exists:", fs.existsSync("/.secret/pmc-portal-credential.json"));

export { auth, db, storage, stripe };
