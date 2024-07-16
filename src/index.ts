import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import { apiRouter } from "./routes";

// CONFIGURE .env
dotenv.config({ path: "./.secret/.env" });

const app = express();

// SET MIDDLEWARE

app.use(
  cors({
    origin: process.env.ORIGIN,
    credentials: true,
  })
);
app.options(`${process.env.ORIGIN}`, cors());

app.use(cookieParser());
app.use(express.json());

// SET ROUTES
app.use("/api/v1", apiRouter);

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
