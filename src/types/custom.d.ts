import { Tables } from "../schema/v2/database.types";

declare global {
    namespace Express {
        interface Request {
            user?: Tables<"User">
        }
    }
}