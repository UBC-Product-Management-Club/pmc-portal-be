import { Parser } from "@json2csv/plainjs";
import { UserExportFields } from "./types";
import { db } from "../../config/firebase";
import { exportUserFieldNames } from "./types";

async function checkUserExists(uid: string) {
    const userRef = db.collection("users").doc(uid);
    const user = await userRef.get();
    return user.exists;
}

const formatCSV = (users: UserExportFields[]) => {
    const parser = new Parser({
        fields: [...exportUserFieldNames],
    });
    return parser.parse(users);
};

export { checkUserExists, formatCSV };
