import sys
import whisper

# Initialize Whisper model
model = whisper.load_model("base")  # Choose 'base' or 'large' based on your needs

def transcribe_audio(audio_file):
    try:
        # Use Whisper to transcribe the audio
        result = model.transcribe(audio_file)
        return result['text']
    except Exception as e:
        print(f"Error during transcription: {e}")
        return None

if __name__ == '__main__':
    audio_file = sys.argv[1]
    
    transcript = transcribe_audio(audio_file)
    if transcript:
        print(f"Transcript: {transcript}")
    else:
        print("Transcription failed.")
