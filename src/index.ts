import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import { v2ApiRouter } from "./routes/v2";
import { webhookRouter } from "./routes/v2/stripe";

// CONFIGURE .env
dotenv.config();
console.log("Environment Variables:");
Object.keys(process.env).forEach((key) => {
    console.log(`${key}: ${process.env[key]}`);
});

const app = express();

// SET MIDDLEWARE

// app.use(
//   cors({
//     origin: process.env.ORIGIN,
//     credentials: true,
//   })
// );

const allowedOrigins = [process.env.ORIGIN, process.env.ADMIN_PORTAL_ORIGIN];

const corsOptions = {
    origin: function (origin: any, callback: any) {
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    optionsSuccessStatus: 200,
    credentials: true,
};

// SET WEBHOOK
app.use("/webhook", webhookRouter);

// SET MIDDLEWARE
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SET ROUTES
app.use("/api", v2ApiRouter);

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
