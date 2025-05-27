import { Request, Response, NextFunction, RequestHandler } from "express";
import { db } from "../../config/firebaseConfig"; 
import { HttpStatus } from "@helpers/errorHandler";

const getAllMeetings: RequestHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const snapshot = await db.collection("meetings").get(); 
    const meetings = snapshot.docs.map((doc) => ({
      id: doc.id, 
      ...doc.data(),
    }));

    res.status(HttpStatus.OK).json({ success: true, meetings });
  } catch (e: any) {
    console.error("Error fetching meetings:", e);
    next(e);
  }
};

export default getAllMeetings;
