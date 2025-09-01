import requests
from bs4 import BeautifulSoup
from groq import Groq

def fetch_html(url):
    """Downloads the raw HTML content from a URL."""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()  # Raise an exception for bad status codes (4xx or 5xx)
        return response.text
    except requests.exceptions.RequestException as e:
        print(f"Error fetching URL {url}: {e}")
        return None
    

def html_to_text(html_content):
    soup = BeautifulSoup(html_content, 'html.parser')
    # A simple way to get the main text, but can be improved.
    return soup.get_text(separator='\n', strip=True)


def get_recipe_from_url(url):
    """
    Extracts recipe content from a URL with proper error handling.
    Returns a structured recipe text or raises an exception.
    """
    try:
        # Validate URL
        if not url or not url.startswith(('http://', 'https://')):
            raise ValueError("Invalid URL provided")
        
        print(f"Fetching recipe from: {url}")
        html = fetch_html(url)
        
        if not html:
            raise Exception("Failed to fetch HTML content from URL")
        
        # Extract recipe text
        recipe = html_to_text(html)
        
        if not recipe or len(recipe.strip()) < 50:  # Basic validation
            raise Exception("No meaningful recipe content found on the page")
        
        # Clean up the recipe text
        recipe = clean_recipe_text(recipe)
        
        print(f"Successfully extracted recipe ({len(recipe)} characters)")
        return recipe
        
    except Exception as e:
        print(f"Error extracting recipe from {url}: {e}")
        raise e

def clean_recipe_text(text):
    """
    Cleans up extracted recipe text to remove common non-recipe content.
    """
    lines = text.split('\n')
    cleaned_lines = []
    
    # Common patterns to skip
    skip_patterns = [
        'cookie', 'privacy', 'terms', 'advertisement', 'advert', 
        'subscribe', 'newsletter', 'share', 'comment', 'footer',
        'navigation', 'menu', 'header', 'sidebar', 'related',
        '©', 'all rights reserved', 'powered by'
    ]
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Skip lines that match skip patterns
        if any(pattern in line.lower() for pattern in skip_patterns):
            continue
            
        # Skip very short lines that are likely navigation
        if len(line) < 10 and line.isupper():
            continue
            
        cleaned_lines.append(line)
    
    return '\n'.join(cleaned_lines)


def parse_recipe_with_llm(groq_client, html_content):
    """
    Uses an LLM to parse the recipe from raw HTML.
    (This is a placeholder for your actual LLM call).
    """
    # 1. Clean the HTML to get the main text content.
    soup = BeautifulSoup(html_content, 'html.parser')
    # A simple way to get the main text, but can be improved.
    main_text = soup.get_text(separator='\n', strip=True)

    token_est = (int)(len(main_text) / 4.0)

    print("--- Sending cleaned text to LLM for structuring ---")
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
            {
                "role": "user",
                "content": "You are an AI cooking assistant trained by an expert chef. Turn "
                "the following recipe into a concise version that removes any fluff but keeps every detail "
                "related to the cooking process and ingredients. It should not be longer than the original recipe. "
                "Here is the recipe: \n " + main_text
            }
            ],
            temperature=0.4,
            max_completion_tokens=token_est,
            top_p=0.8,
            stream=False,
            stop=None
        )

    except Exception as e:
        print("Error with LLM inference.")
        return None
    # Placeholder for the structured data you'd get back from the LLM.
    recipe = completion.choices[0].message.content
    
    return recipe

def get_recipe_from_url_llm(groq_client, url):
    """
    Main function to get a structured recipe from a website URL.
    """
    print(f"Attempting to scrape recipe from: {url}")
    html = fetch_html(url)
    
    if html:
        recipe = parse_recipe_with_llm(groq_client, html)
        return recipe
    
    return None
