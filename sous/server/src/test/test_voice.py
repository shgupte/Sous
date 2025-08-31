import asyncio
import websockets
import json
import time
import wave
# --- CONFIGURATION ---
# The URL of your running FastAPI WebSocket endpoint
SERVER_URL = "ws://localhost:8000/listen/test/test"

# The path to your test audio file
# ❗ IMPORTANT: Update this path to point to your actual .wav file
AUDIO_FILE_PATH = "/Users/sgupte/Documents/GitHub/sous/sous/server/audio_data/spacewalk.wav"

wf = wave.open(AUDIO_FILE_PATH,"rb")
print(wf.getnchannels(), wf.getsampwidth(), wf.getframerate())



async def run_test():
    """
    Connects to the FastAPI server, streams an audio file, and prints all
    messages received from the voice agent.
    """
    try:
        print(f"Attempting to connect to your server at {SERVER_URL}...")
        async with websockets.connect(SERVER_URL) as websocket:
            print("✅ Connection successful!")
            print(f"🚀 Streaming audio from '{AUDIO_FILE_PATH}'...")

            async def send_audio():
                """Reads the audio file in chunks and sends it over the WebSocket."""
                with open(AUDIO_FILE_PATH, "rb") as audio_file:
                    header = audio_file.raw.read(44)

      # Verify WAV header
                    if header[0:4] != b'RIFF' or header[8:12] != b'WAVE':
                        print("Invalid WAV header")
                        return
                    
                    while True:
                        print("streaming audio")
                        data = audio_file.raw.read(4096)
                            
                        if not data:
                            break
                        await websocket.send(data)
                        await asyncio.sleep(0.01) # Small sleep to simulate real-time stream
                    print("✅ Finished streaming audio.")

            async def receive_messages():
                """Listens for and prints messages from the server."""
                print("... Listening for responses from the agent ...")
                async for message in websocket:
                    print("\n" + "="*20 + " MESSAGE FROM SERVER " + "="*20)
                    # We parse and re-dump the JSON to pretty-print it
                    parsed_message = json.loads(message)
                    print(json.dumps(parsed_message, indent=2))
                    print("="*61)


            # Run both the sending and receiving tasks at the same time
            await asyncio.gather(send_audio(), receive_messages())

    except websockets.exceptions.ConnectionClosedError as e:
        print(f"❌ Connection closed unexpectedly: {e}")
        print("   Is your FastAPI server running?")
    except ConnectionRefusedError:
        print(f"❌ Connection refused.")
        print(f"   Please make sure your FastAPI server is running at {SERVER_URL.replace('ws', 'http')}")
    except FileNotFoundError:
        print(f"❌ Audio file not found at '{AUDIO_FILE_PATH}'")
        print("   Please update the AUDIO_FILE_PATH variable in this script.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(run_test())
