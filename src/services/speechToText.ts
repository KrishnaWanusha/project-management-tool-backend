// import speech from "@google-cloud/speech";
// import { db } from "../config/firebaseConfig"; // Firestore DB instance

// const client = new speech.SpeechClient(); // 🔥 Initialize Google Speech API Client

// /**
//  * Converts an audio file (from Firebase Storage) into text using Google Speech-to-Text.
//  * @param fileURL - Public URL of the uploaded audio file
//  * @returns Transcribed text
//  */
// export const convertSpeechToText = async (fileURL: string): Promise<string> => {
//   try {
//     console.log(`🗣️ Converting Speech to Text for: ${fileURL}`);

//     const audio = {
//       uri: fileURL, // ✅ Firebase Storage URL
//     };

//     const config = {
//       encoding: "LINEAR16", // Change if needed (MP3 = "MP3", WAV = "LINEAR16")
//       sampleRateHertz: 16000, // Adjust if required
//       languageCode: "en-US", // Change for different languages
//     };

//     const request = { audio, config };
//     const [response] = await client.recognize(request);

//     if (!response.results || response.results.length === 0) {
//       throw new Error("No speech detected.");
//     }

//     // 🔹 Join all transcript results
//     const transcript = response.results.map((result) => result.alternatives[0].transcript).join(" ");

//     console.log(`✅ Transcript: ${transcript}`);

//     return transcript;
//   } catch (error) {
//     console.error("❌ Error converting speech to text:", error);
//     throw new Error("Failed to transcribe audio.");
//   }
// };
