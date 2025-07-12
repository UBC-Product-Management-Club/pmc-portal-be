import { Parser } from "@json2csv/plainjs";
import { exportUserFieldNames, UserExportFields } from "../../schema/v1/User";

const formatCSV = (users: UserExportFields[]) => {
    const parser = new Parser({
        fields: [...exportUserFieldNames],
    });
    return parser.parse(users);
};

export { formatCSV };
