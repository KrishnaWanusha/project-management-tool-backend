import { bucket } from '../config/firebaseConfig';  // Correct import from firebaseConfig

/**
 * Uploads a file to Firebase Storage and returns a public URL.
 * @param fileBuffer - The file buffer (audio, video, etc.)
 * @param fileName - The name of the file
 * @returns Public URL of the uploaded file
 */
export const uploadToFirebase = async (fileBuffer: Buffer, fileName: string): Promise<string> => {
  try {
    const fileUpload = bucket.file(`meetings/${fileName}`);

    // Upload the file to Firebase Storage
    await fileUpload.save(fileBuffer, {
      metadata: { contentType: 'audio/mp3' },  // Ensure the MIME type is correct (audio/mp3 in this case)
    });

    // Generate a signed URL for the uploaded file (the URL will be valid until the specified expiry date)
    const [fileURL] = await fileUpload.getSignedUrl({
      action: 'read',  // Allow read access
      expires: '03-01-2030',  // URL expiration date (adjust as needed)
    });

    return fileURL;  // Return the public URL of the uploaded file
  } catch (error) {
    console.error('Error uploading file to Firebase:', error);
    throw new Error('Failed to upload file to Firebase.');
  }
};
