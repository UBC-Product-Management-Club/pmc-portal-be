import { Request, Response } from "express";

export const getHello = async (req: Request, res: Response) => {
  try {
    res.send("Hello World!");
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
