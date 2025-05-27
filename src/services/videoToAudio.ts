// import { PythonShell } from 'python-shell';

// // Function to call Python script and convert video to audio
// const convertVideoToAudio = (inputVideoPath: string, outputAudioPath: string): Promise<string> => {
//   return new Promise((resolve, reject) => {
//     const options = {
//       args: [inputVideoPath, outputAudioPath]  // Passing file paths to the Python script
//     };

//     // Running Python script using python-shell
//     PythonShell.run('videoToAudio.py', options, (err, result) => {
//       if (err) {
//         console.error('Error during conversion:', err);
//         return reject('Error during conversion');
//       }
      
//       // Check if the result is not empty, return the output audio file path
//       if (result && result.length > 0) {
//         console.log('Audio file created at:', result[0]);
//         resolve(result[0]);  // Assuming result[0] contains the output file path
//       } else {
//         reject('Conversion failed');
//       }
//     });
//   });
// };

// // Example Usage
// convertVideoToAudio('path/to/video.mp4', 'path/to/output/audio.mp3')
//   .then((audioFilePath) => {
//     console.log('Conversion successful:', audioFilePath);
//   })
//   .catch((error) => {
//     console.error('Error:', error);
//   });
