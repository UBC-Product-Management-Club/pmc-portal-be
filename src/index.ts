import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import { apiRouter } from "./routes";

// CONFIGURE .env
dotenv.config({ path: "./.secret/.env" });

const app = express();

// SET MIDDLEWARE

// app.use(
//   cors({
//     origin: process.env.ORIGIN,
//     credentials: true,
//   })
// );

const corsOptions = {
  origin: function (origin: any, callback: any) {
    console.log(origin, process.env.ORIGIN, origin === undefined)
    if (process.env.ORIGIN === origin || !origin || origin === undefined) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  optionsSuccessStatus: 200,
  credentials: true,
};

app.use(cors(corsOptions))
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({extended: true}))


// SET ROUTES
app.use("/api/v1", apiRouter);

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
