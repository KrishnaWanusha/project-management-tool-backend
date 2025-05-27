// import { Request, Response, RequestHandler, NextFunction } from 'express'
// import path from 'path'
// import fs from 'fs'
// import { db } from '../../config/firebaseConfig'
// import axios from 'axios' // Import Axios to communicate with FastAPI

// const createMeeting: RequestHandler = async (
//   req: Request ,
//    res: Response,
//     next: NextFunction) => {
//   try {
//     const { name, description, type, date, members } = req.body
//     const file = req.file

//     // Step 1: Check if file is uploaded
//     if (!file) {
//       return res.status(400).json({ success: false, message: 'No file uploaded.' })
//     }

//     // Step 2: Save the file locally
//     const filePath = path.join(__dirname, 'uploads', file.originalname)
//     fs.writeFileSync(filePath, file.buffer)

//     // Step 3: Send the file path to Flask API for processing (transcription, summarization, sentiment analysis)
//     const fileName = file.originalname
//     const flaskApiUrl = 'https://document-gen-python.niceflower-88a4168e.eastus.azurecontainerapps.io/process' // Flask API endpoint
//     try {
//       const response = await axios.post(flaskApiUrl, {
//         filename: filePath // Send the file path to Flask
//       })
//       const { transcript, summary, sentiment_label ,sentiment_score } = response.data


//       // Step 4: Save the data to MongoDB
//       const meetingRef = await db.collection('meetings').add({
//         name,
//         description,
//         type,
//         date,
//         uploadedFile: fileName, // Store the file name in MongoDB
//         members: members || [],
//         transcript,
//         summary,
//         sentimentAnalysis: {
//           label: sentiment_label,
//           score: sentiment_score
//         },
//         createdAt: new Date()
//       })

//       const meetingId = meetingRef.id

//       // Step 5: Return success response
//       return res.status(201).json({
//         success: true,
//         message: 'Meeting created and processed successfully!',
//         meetingId,
//         transcript,
//         sentimentAnalysis: {
//           label: sentiment_label,
//           score: sentiment_score
//         },
//         summary
//       })
//     } catch (error) {
//       console.error('Error calling Flask API for processing:', error)
//       return res.status(500).json({
//         success: false,
//         message: 'Error processing meeting data through Flask API.'
//       })
//     }
//   } catch (error) {
//     console.error('Error creating meeting:', error)
//     return next(error)
//   }
// }

// export default createMeeting
import { Request, Response, NextFunction } from 'express';
import { db, bucket } from '../../config/firebaseConfig'; // Your Firebase config import
import axios from 'axios';

const createMeeting = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, type, date, members } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    // Upload file to Firebase Storage bucket
    const remoteFilePath = `meetings/${file.originalname}`;
    const remoteFile = bucket.file(remoteFilePath);
    await remoteFile.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    // The path you will send to Flask API (Flask must download this)
    // e.g. "meetings/filename.mp4"
    const firebaseStoragePath = remoteFilePath;

    // URL of your hosted Flask API (update to your real Flask URL)
    const flaskApiUrl = 'https://document-gen-python.niceflower-88a4168e.eastus.azurecontainerapps.io/process';

    // Send Firebase Storage path to Flask API in JSON body
    const response = await axios.post(flaskApiUrl, {
      firebase_path: firebaseStoragePath
    });

    const { transcript, summary, sentiment_label, sentiment_score } = response.data;

    // Save meeting info + analysis results to Firestore
    const meetingRef = await db.collection('meetings').add({
      name,
      description,
      type,
      date,
      uploadedFileName: file.originalname,
      uploadedFileUrl: `gs://${bucket.name}/${remoteFilePath}`, // store gs:// path
      members: members || [],
      transcript,
      summary,
      sentimentAnalysis: {
        label: sentiment_label,
        score: sentiment_score,
      },
      createdAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: 'Meeting created and processed successfully!',
      meetingId: meetingRef.id,
      transcript,
      sentimentAnalysis: {
        label: sentiment_label,
        score: sentiment_score,
      },
      summary,
    });
  } catch (error) {
    console.error('Error creating meeting:', error);
    return next(error);
  }
};

export default createMeeting;
