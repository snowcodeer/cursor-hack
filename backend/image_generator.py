"""
Image generation endpoint using Gemini 2.5 Flash (same as comic_generator.py)
"""
import os
import sys
import base64
import json
import logging
from io import BytesIO
from dotenv import load_dotenv
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, origins=['http://localhost:5173'])

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def generate_image(prompt: str) -> str:
    """
    Generate image using Gemini 2.5 Flash Image Preview
    Returns base64 encoded image string
    """
    api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
    if not api_key:
        raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY not found in environment variables")
    
    genai.configure(api_key=api_key)
    
    logger.info(f"Generating image with prompt: {prompt[:100]}...")
    logger.info("This may take 30-60 seconds...")
    
    try:
        # Use the same model as comic_generator.py
        model = genai.GenerativeModel("gemini-2.5-flash-image-preview")
        
        # Create prompt with system instructions
        system_prompt = (
            "You are an image generator. Create a stunning, detailed image based on the prompt. "
            "The artwork should be high quality and visually appealing. "
            "CRITICAL: The artwork MUST fill the ENTIRE image frame from edge to edge. "
            "NO borders, NO frames, NO white space, NO black bars. "
            "The image should bleed to all four edges."
        )
        
        full_prompt = f"{system_prompt}\n\nPrompt: {prompt}"
        
        response = model.generate_content(full_prompt)
        
        logger.info("API request successful!")
        
        # Process response - same as comic_generator.py
        for part in response.candidates[0].content.parts:
            if part.inline_data is not None:
                # Get binary image data
                image_bytes = part.inline_data.data
                logger.info(f"Received image data: {len(image_bytes)} bytes")
                
                # Convert to base64
                base64_image = base64.b64encode(image_bytes).decode('utf-8')
                logger.info(f"Converted to base64: {len(base64_image)} chars")
                
                return base64_image
        
        raise Exception("No image data found in response")
        
    except Exception as e:
        logger.error(f"Error generating image: {e}", exc_info=True)
        raise Exception(f"Error generating image: {e}")

@app.route('/api/generate-image', methods=['POST'])
def generate_image_endpoint():
    try:
        data = request.json
        prompt = data.get('prompt')
        
        if not prompt:
            return jsonify({'error': 'Prompt is required'}), 400
        
        logger.info(f"Received request for image generation")
        base64_image = generate_image(prompt)
        
        # Return in format expected by frontend
        return jsonify({
            'generatedImages': [{
                'base64Image': base64_image,
                'mimeType': 'image/png'
            }]
        })
        
    except Exception as e:
        logger.error(f"Error in endpoint: {e}", exc_info=True)
        return jsonify({
            'error': 'Failed to generate image',
            'details': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 3001))
    logger.info(f"Starting image generation server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=True)

