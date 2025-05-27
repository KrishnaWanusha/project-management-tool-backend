import sys
import ffmpeg

def convert_video_to_audio(video_path, audio_path):
    try:
        # Use FFmpeg to convert video to audio
        ffmpeg.input(video_path).output(audio_path).run()
        return audio_path
    except Exception as e:
        print(f"Error during conversion: {e}")
        return None

if __name__ == '__main__':
    video_file = sys.argv[1]
    audio_file = sys.argv[2]
    
    result = convert_video_to_audio(video_file, audio_file)
    if result:
        print(f"Audio file saved at {result}")
    else:
        print("Conversion failed.")
