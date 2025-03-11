import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import { apiRouter } from "./routes";

// CONFIGURE .env
dotenv.config();
console.log('Environment Variables:');
Object.keys(process.env).forEach(key => {
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

const allowedOrigins = [
  process.env.ORIGIN,
  process.env.ADMIN_ORIGIN
]

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


