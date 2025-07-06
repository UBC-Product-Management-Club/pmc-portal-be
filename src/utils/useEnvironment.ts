import dotenv from "dotenv";
dotenv.config({ path: "./.secret/.env" });

export function useEnvironment() {
    const env = process.env.ENVIRONMENT?.toUpperCase();

    return {
        isProd: env === 'PROD',
  };
}