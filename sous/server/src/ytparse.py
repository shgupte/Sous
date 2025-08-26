from youtube_transcript_api import YouTubeTranscriptApi

# This module lowkey doesn't work

# Get transcript from YT video
def extract_transcript(link: str) -> str:
    try:   
        _ = link.split("=")
        video_id = _[1]
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
        full_transcript = " ".join([item['text'] for item in transcript_list])
        return full_transcript

    except Exception as e:
        print("Invalid Youtube link.")
        return None
    
# Save local version of YT transcript
def extract_and_save_transcript(link: str, output_path: str):
    try:   
        _ = link.split("=")
        video_id = _[1]
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
        full_transcript = " ".join([item['text'] for item in transcript_list])
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(full_transcript)
        print(f"Transcript saved to {output_path}")

    except Exception as e:
        print("Invalid Youtube link.")
        return None
    
