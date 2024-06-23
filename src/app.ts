import express from "express";
import helloRoutes from "./routes/hello";
import { db } from "./config/firebase";

const app = express();

app.use(express.json());

app.use("/api/v1", helloRoutes);

export default app;
