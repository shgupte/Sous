import re
import chromadb
import uuid
import os
import asyncio
import time
import json
import threading
from groq import Groq
from dotenv import load_dotenv
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from deepgram import (
    DeepgramClient,
    DeepgramClientOptions,
    AgentWebSocketEvents,
    SettingsOptions,
    AgentKeepAlive,
    Output,
    FunctionCallRequest
)

AUDIO_FILE_PATH = "/Users/sgupte/Documents/GitHub/sous/sous/server/audio_data/Pasta.wav"

# --- Environment and Client Setup ---
load_dotenv()
router = APIRouter()

chroma_client = chromadb.CloudClient(
    api_key=os.getenv("CHROMA_API_KEY"),
    tenant='c833b000-d314-424c-9d0d-7689488d52de',
    database='sous-dev'
)
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
collection = chroma_client.get_or_create_collection(name="recipes")


# --- RAG and ChromaDB Helper Functions ---

def chroma_retrieve_docs(question, recipe_id, user_id):
    try:
        results = collection.query(
            query_texts=[question],
            n_results=6,
            where={
                "$and": [
                    {"recipe_id": {"$eq": "temp"}},
                    {"user_id": {"$eq": "temp"}},
                ]
            }
        )
        return results["documents"]
    except Exception as e:
        print(f"ChromaDB retrieval error: {e}")
        return None

def build_context(docs_in, max_chunks=6, max_chars=6000, separator="\n\n---\n\n"):
    if not docs_in or not docs_in[0]:
        return "There is no available context for this query."
    
    docs = docs_in[0][:max_chunks]
    cleaned = [d.strip() for d in docs if isinstance(d, str) and d.strip()]
    context = separator.join(cleaned)
    return context[:max_chars]

def get_rag_context(question: str, recipe_id: str, user_id: str):
    """Retrieves context from ChromaDB to answer a user's question."""
    try:
        docs_nested = chroma_retrieve_docs(question, recipe_id, user_id)
        if not docs_nested:
            return "Couldn’t retrieve any matching content for that question."
        
        context = build_context(docs_nested)
        return context
    except Exception as e:
        return f"RAG error: {str(e)}"

# --- FastAPI WebSocket Endpoint ---

@router.websocket("/listen/{user_id}/{recipe_id}")
async def websocket_endpoint(
    client_websocket: WebSocket,
    user_id: str,
    recipe_id: str
):
    await client_websocket.accept()
    dg_connection = None
    
    # Define your tools here. You can add more tools to this list.
    RAG_TOOL = {
        "type": "function",
        "function": {
            "name": "get_rag_context",
            "description": "Retrieves specific information about the recipe the user is currently working on to answer their questions. "
            "You should ALWAYS use this function when the user asks a question about the recipe.",
            "parameters": {
                "type": "object",
                "properties": { "question": {"type": "string", "description": "The user's specific question about the recipe."}},
                "required": ["question"]
            }
        }
    }

    FUNCTION_DEFINITIONS = [
    {
            "name": "get_rag_context",
            "description": "Retrieves specific information about the recipe the user is currently working on to answer their questions. "
            "You should ALWAYS use this function when the user asks a question about the recipe.",
            "parameters": {
                "type": "object",
                "properties": { "question": {"type": "string", "description": "The user's specific question about the recipe."}},
                "required": ["question"]
            }
    }
  ]

    

    try:
        api_key = os.getenv("DEEPGRAM_API_KEY")
        if not api_key: raise ValueError("DEEPGRAM_API_KEY not set")

        config = DeepgramClientOptions(options={"keepalive": "true"})
        deepgram = DeepgramClient(api_key, config)
        dg_connection = deepgram.agent.websocket.v("1")
        options = SettingsOptions()
        # Audio input configuration
        options.audio.input.encoding = "linear16"
        options.audio.input.sample_rate = 16000
        # Audio output configuration
        options.audio.output.container = "wav"
        options.audio.output = Output(
                encoding="linear16",
                sample_rate=16000,
                container="wav"
            )
        # Agent configuration
        options.agent.language = "en"
        options.agent.listen.provider.type = "deepgram"
        options.agent.listen.provider.model = "nova-3"
        options.agent.listen.model = "nova-3"
        options.agent.think.provider.type = "open_ai"
        options.agent.think.provider.model = "gpt-4o-mini"
        options.agent.think.functions = FUNCTION_DEFINITIONS
        options.agent.think.prompt = "You are an expert cooking assistant who is concise and practical."
        options.agent.speak.provider.type = "deepgram"
        options.agent.speak.provider.model = "aura-2-thalia-en"
        options.agent.greeting = "Ask me anything about your recipe."

        loop = asyncio.get_running_loop()

        # Handler for when the agent wants to call our function
        def on_function_call(function_call, **kwargs):
            print("Running a function call")
            print(f"function_call type: {type(function_call)}")
            print(f"kwargs: {kwargs}")
            
            # The function call data is in kwargs['function_call_request']
            function_call_request = kwargs.get('function_call_request')
            if not function_call_request:
                print("No function call request found in kwargs")
                return
            
            print(f"Function call request: {function_call_request}")
            
            # Extract the function details from the request
            if hasattr(function_call_request, 'functions') and function_call_request.functions:
                function_data = function_call_request.functions[0]  # Get the first function
                
                function_name = function_data.name
                arguments = function_data.arguments
                tool_call_id = function_data.id
                
                print(f"Function name: {function_name}")
                print(f"Arguments: {arguments}")
                print(f"Tool call ID: {tool_call_id}")
                
                if function_name == 'get_rag_context':
                    print("✅ Agent is calling the RAG function...")
                    args = json.loads(arguments) if isinstance(arguments, str) else arguments
                    
                    context = get_rag_context(
                        question=args.get('question'),
                        recipe_id=recipe_id,
                        user_id=user_id
                    )
                    
                    print(f"📦 Sending context back to agent: {context[:100]}...")
                    # Synchronous send, per Deepgram SDK docs
                    dg_connection.send(json.dumps({
                        "type": "FunctionCallResponse",
                        "id": tool_call_id,#kwargs.get('request_id'),
                        "name": "get_rag_context",
                        "content": context
                    }))
                else:
                    print(f"⚠️ Agent requested an unknown function: {function_name}")
            else:
                print("No functions found in function call request")
                
        # except Exception as e:
        #     print(f"Error processing function call: {e}")
        #     print(f"function_call: {function_call}")
        #     print(f"kwargs: {kwargs}")

        # Handler for forwarding text (transcripts) to the client
        def on_conversation_text(self, conversation_text, **kwargs):
            # Optional: Handle specific types like 'History' if needed
            data = json.loads(conversation_text.to_json())
            if data.get('type') == 'History':
                print(f"Handled History message: {data}")
                # You can add custom logic here, e.g., send a specific response
            print("Sending text back: " + conversation_text.to_json())
            # Run async send thread-safely
            asyncio.run_coroutine_threadsafe(
                client_websocket.send_text(conversation_text.to_json()),
                loop
            )
                    
        # Handler for forwarding agent's audio to the client
        def on_agent_audio(self, data, **kwargs):
            print("Sending audio back.")
            # Run async send thread-safely
            # asyncio.run_coroutine_threadsafe(
            #     client_websocket.send_bytes(audio),
            #     loop
            # )
        
        def on_agent_audio_done(self, **kwargs):
            print("Audio done.")

        def on_error(self, error, **kwargs):
            print(f"Deepgram Error: {error}")

        def on_close(self, **kwargs):
            print("Deepgram connection closed.")
        
        def on_welcome(self, **kwargs):
            print("Successfully connected to Deepgram.")

        def on_user_started_speaking(self, user_started_speaking, **kwargs):
                print(f"Deepgram User Started Speaking: {user_started_speaking}")

        def on_agent_thinking(self, agent_thinking, **kwargs):
            print("Agent is thinking.")

        

        # --- Register the Event Handlers ---
        dg_connection.on(AgentWebSocketEvents.Welcome, on_welcome)
        dg_connection.on(AgentWebSocketEvents.FunctionCallRequest, on_function_call)
        dg_connection.on(AgentWebSocketEvents.ConversationText, on_conversation_text)
        dg_connection.on(AgentWebSocketEvents.AudioData, on_agent_audio)
        dg_connection.on(AgentWebSocketEvents.AgentAudioDone, on_agent_audio_done)
        dg_connection.on(AgentWebSocketEvents.Error, on_error)
        dg_connection.on(AgentWebSocketEvents.Close, on_close)
        dg_connection.on(AgentWebSocketEvents.UserStartedSpeaking, on_user_started_speaking)
        dg_connection.on(AgentWebSocketEvents.AgentThinking, on_agent_thinking)
        
         # dg_connection.on(AgentWebSocketEvents.Close, on_close)
        

        dg_connection.start(options)
        print(f"🚀 Deepgram connection started for user '{user_id}' and recipe '{recipe_id}'.")


        # Main loop: Forward audio from your client to Deepgram
        def send_keep_alive():
          while True:
              time.sleep(5)
              print("Keep alive!")
              dg_connection.send(str(AgentKeepAlive()))
        
        # Start keep-alive in a separate thread
        keep_alive_thread = threading.Thread(target=send_keep_alive, daemon=True)
        keep_alive_thread.start()
        
        while True:
            audio_data = await client_websocket.receive_bytes()
            dg_connection.send(audio_data)
        
        

    except WebSocketDisconnect:
        print(f"Client disconnected: user '{user_id}', recipe '{recipe_id}'.")
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        if dg_connection:
            dg_connection.finish()
            print("Deepgram connection closed.")

