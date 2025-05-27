import * as firebaseAdmin from 'firebase-admin';
import * as path from 'path';

// Initialize Firebase only if it hasn't been initialized
const initializeFirebase = () => {
  if (firebaseAdmin.apps.length === 0) {
    const serviceAccountPath = path.resolve(__dirname, 'project-management-1634d-firebase-adminsdk-fbsvc-3b1d822bfe.json');
    
    // Initialize Firebase with service account credentials
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccountPath),
      storageBucket: 'project-management-1634d.firebasestorage.app',  // Replace with your actual Firebase Storage bucket
    });

    console.log('Connected to Firebase successfully!');  // Added message for successful connection
  } else {
    firebaseAdmin.app();  // Use the already initialized app
  }

  // Initialize Firestore and Firebase Storage
  const db = firebaseAdmin.firestore();
  const bucket = firebaseAdmin.storage().bucket();

  return { db, bucket };
};

const { db, bucket } = initializeFirebase();

// Export the function and initialized db and bucket
export { initializeFirebase, db, bucket };  // Ensure you're exporting bucket correctly
