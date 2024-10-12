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

const allowedOrigins = process.env.ORIGIN ? process.env.ORIGIN.split(',') : '*';

console.log(allowedOrigins)

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins === '*' || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Content-Type,Authorization"
  })
);

// app.options(`${process.env.ORIGIN}`, cors());
app.options('*', cors());


app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({extended: true}))


// SET ROUTES
app.use("/api/v1", apiRouter);

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
