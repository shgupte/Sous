from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from websockets.client import connect
from fastapi.responses import JSONResponse
from src.ytparse import extract_transcript
from src.webparse import fetch_html, get_recipe_from_url, html_to_text
from groq import Groq
from dotenv import load_dotenv
import chromadb
import uuid
import re
import src.pipeline as pipeline
from fastapi.middleware.cors import CORSMiddleware

import os



load_dotenv()

# Create an instance of the FastAPI application
app = FastAPI()

# Include the pipeline router
app.include_router(pipeline.router)

# --- ADD THIS MIDDLEWARE BLOCK ---
# Define the origins that are allowed to connect.
# For local development, using "*" is easiest.
origins = [
    "*", 
    # For production, you would list your specific frontend domains:
    # "http://localhost",
    # "http://localhost:3000",
    # "https://your-frontend-app.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods
    allow_headers=["*"], # Allows all headers
)
# --------------------------------



@app.get("/")
def read_root():
    """
    This is the main endpoint. It will be accessible at the root URL of the server.
    """
    return JSONResponse(content={"message": "Hello world" })

@app.get("/health")


def health_check():
    """
    A dedicated health check endpoint, which is a common practice.
    """
    return JSONResponse(content={"status": "ok"})


@app.get("/test")
def test_rag():
    text = html_to_text(fetch_html("https://www.seriouseats.com/pasta-with-vodka-sauce"))
    input_chunks = pipeline.semantic_chunker(text=text)
    print(input_chunks)
    # rag.chroma_upload_chunks(input_chunks, "temp", "temp")
    answer = pipeline.answer_with_rag("How pork should I get?", "temp", "temp")
    return JSONResponse(content={"message":answer})

