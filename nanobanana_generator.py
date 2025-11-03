#!/usr/bin/env python3
"""
Simple Gemini 2.5 Flash image generation test using the exact code structure provided
"""

import os
from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def main():
    # Initialize client with API key
    api_key = os.getenv('GOOGLE_API_KEY')
    if not api_key:
        print("❌ Error: GOOGLE_API_KEY not found in environment variables")
        return 1
    
    client = genai.Client(api_key=api_key)
    
    # Define image paths
    illustration_path = "../images/illustration.png"
    object_path = "../images/object.png"
    
    # Validate image paths
    if not os.path.exists(illustration_path):
        print(f"❌ Error: Illustration image not found: {illustration_path}")
        return 1
    if not os.path.exists(object_path):
        print(f"❌ Error: Object image not found: {object_path}")
        return 1
    
    # Load images
    illustration_img = Image.open(illustration_path)
    object_img = Image.open(object_path)
    
    # Create prompt with enhanced requirements for exact illustration preservation
    prompt = (
        "Create a realistic product mockup image that combines the illustration from the first image with the object from the second image. "
        "CRITICAL: The illustration must look IDENTICAL to the original - same colors, same details, same style. "
        "Do not modify, reinterpret, or change the illustration in any way. "
        "Remove any background or other elements from the object, including watermarks. "
        "Make it look like a professional product photo for marketing or e-commerce. "
        "CRITICAL: Remove all watermarks or text overlays from the object."
    )
    
    print("🔄 Generating product mockup with Gemini 2.5 Flash...")
    print("⏳ This may take 30-60 seconds...")
    
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-image-preview",
            contents=[prompt, illustration_img, object_img],
        )
        
        print("✅ API request successful!")
        
        # Process response using the exact structure from your example
        for part in response.candidates[0].content.parts:
            if part.text is not None:
                print(part.text)
            elif part.inline_data is not None:
                image = Image.open(BytesIO(part.inline_data.data))
                image.save("nanobanana_mockup.png")
                print("🎉 Successfully generated and saved nanobanana_mockup.png")
                return 0
        
        print("⚠️ No image data found in response")
        return 1
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1

if __name__ == "__main__":
    exit(main())
