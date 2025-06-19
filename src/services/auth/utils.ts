import { Parser } from "@json2csv/plainjs";
import { UserExportFields } from "./types";
import { db } from "../../config/firebase";
import { exportUserFieldNames } from "./types";

const formatCSV = (users: UserExportFields[]) => {
    const parser = new Parser({
        fields: [...exportUserFieldNames],
    });
    return parser.parse(users);
};

export { formatCSV };
