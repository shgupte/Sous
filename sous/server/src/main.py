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
from pydantic import BaseModel

# pipline has most of the logic for the app
# Will likely refactor later to make the app more modular
####################################
import src.pipeline as pipeline
####################################
from fastapi.middleware.cors import CORSMiddleware

import os

load_dotenv()

# Create an instance of the FastAPI application
app = FastAPI()

# Include the pipeline router
app.include_router(pipeline.router)

# Define the origins that are allowed to connect.
# For local development, using "*" is easiest.
origins = [
    "*", 
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
    return JSONResponse(content={"message": "Welcome to Sous!" })

@app.get("/health")
def health_check():
    """
    A dedicated health check endpoint
    """
    return JSONResponse(content={"status": "ok"})


class RecipeSubmission(BaseModel):
    recipe_id: int
    user_id: int
    text: str

class RecipeDeletion(BaseModel):
    recipe_id: int
    user_id: int

class RecipeParse(BaseModel):
    url: str

@app.post("/chroma-upload-recipe/")
async def chroma_upload(recipe_submission: RecipeSubmission):
    recipe_id = recipe_submission.recipe_id
    user_id = recipe_submission.user_id
    text = recipe_submission.text
    try:
        # Chunk the recipe text into smaller pieces
        chunks = chunk_recipe_text(text, max_chunk_size=1000, overlap=200)
        
        # Prepare data for ChromaDB
        documents = []
        metadatas = []
        ids = []
        
        for i, chunk in enumerate(chunks):
            chunk_id = f"recipe_{recipe_id}_user_{user_id}_chunk_{i}"
            documents.append(chunk)
            metadatas.append({
                "user_id": str(user_id), 
                "recipe_id": str(recipe_id),
                "chunk_index": i,
                "total_chunks": len(chunks),
                "chunk_type": "recipe_content"
            })
            ids.append(chunk_id)
        
        # Upload chunks to ChromaDB
        pipeline.collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        
        print(f"Successfully uploaded {len(chunks)} chunks for recipe {recipe_id} (user {user_id}) to ChromaDB")
        return JSONResponse(content={"message": f"Chroma upload successful - {len(chunks)} chunks uploaded"})
    except Exception as e:
        print(f"Error uploading recipe to Chroma: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=500)

def chunk_recipe_text(text: str, max_chunk_size: int = 1000, overlap: int = 200) -> list[str]:
    """
    Chunk recipe text into smaller pieces with overlap for better context.
    
    Args:
        text: The recipe text to chunk
        max_chunk_size: Maximum characters per chunk
        overlap: Number of characters to overlap between chunks
    
    Returns:
        List of text chunks
    """
    if len(text) <= max_chunk_size:
        return [text]
    
    chunks = []
    start = 0
    
    while start < len(text):
        # Find the end of this chunk
        end = start + max_chunk_size
        
        # If this isn't the last chunk, try to break at a sentence boundary
        if end < len(text):
            # Look for sentence endings within the last 100 characters
            search_start = max(start + max_chunk_size - 100, start)
            search_end = min(end + 50, len(text))
            
            # Find the last sentence ending in this range
            last_period = text.rfind('.', search_start, search_end)
            last_newline = text.rfind('\n', search_start, search_end)
            
            # Prefer newlines over periods for recipe content
            if last_newline > start + max_chunk_size - 200:
                end = last_newline + 1
            elif last_period > start + max_chunk_size - 200:
                end = last_period + 1
        
        # Extract the chunk
        chunk = text[start:end].strip()
        if chunk:  # Only add non-empty chunks
            chunks.append(chunk)
        
        # Move to next chunk with overlap
        start = end - overlap
        if start >= len(text):
            break
    
    return chunks

@app.post("/chroma-delete-recipe/")
async def chroma_delete(recipe_submission: RecipeDeletion):
    recipe_id = recipe_submission.recipe_id
    user_id = recipe_submission.user_id
    try:
        # Delete by metadata
        pipeline.collection.delete(
            where={
                "$and": [
                    {"recipe_id": {"$eq": str(recipe_id)}},
                    {"user_id": {"$eq": str(user_id)}},
                    {"chunk_type": {"$eq": "recipe_content"}}
                ]
            }
        )
        print(f"Successfully deleted recipe {recipe_id} for user {user_id} from ChromaDB")
        return JSONResponse(content={"message": "Chroma delete successful"})
    except Exception as e:
        print(f"Error deleting recipe from Chroma: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/parse-recipe/")
def parse_recipe(url: str):
    try:
        recipe = get_recipe_from_url(url)
        print(f"Successfully parsed recipe from URL: {url}")
        return JSONResponse(content={"message": recipe})
    except Exception as e:
        print(f"Error parsing recipe from URL {url}: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=500)






