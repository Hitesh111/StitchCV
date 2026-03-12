import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
response = requests.get(url)

if response.status_code == 200:
    data = response.json()
    print("Available Embedding Models:")
    for model in data.get("models", []):
        name = model.get("name")
        methods = model.get("supportedGenerationMethods", [])
        if "embedContent" in methods:
            print(f"- {name} (supports embedContent)")
else:
    print(f"Error {response.status_code}: {response.text}")
