import { Request, Response, NextFunction, RequestHandler } from "express";
import { db } from "../../config/firebaseConfig"; 
import { AppError, HttpStatus } from "@helpers/errorHandler";

const getMeeting: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id; 

    if (!id) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Meeting ID is required"); 
    }

    const meetingDoc = await db.collection("meetings").doc(id).get(); 

    if (!meetingDoc.exists) {
      throw new AppError(HttpStatus.NOT_FOUND, "Meeting not found");
    }

    const meetingData = meetingDoc.data();

    res.status(HttpStatus.OK).json({ success: true, meeting: { id, ...meetingData } });
  } catch (e: any) {
    console.error("Error fetching meeting:", e);
    next(e);
  }
};

export default getMeeting;
