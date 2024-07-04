import express from "express";
import { db } from "./config/firebase";
import { authRouter } from "./routes/auth";

const app = express();

app.use(express.json());

app.use("/api/v1/auth", authRouter);

export default app;
