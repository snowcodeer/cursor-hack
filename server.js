import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for the frontend
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// Initialize Gemini AI
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.warn('⚠️  GEMINI_API_KEY not found - image generation will fail');
}

// Proxy endpoint for Gemini Image Generation (using GenerativeModel like comic_generator.py)
app.post('/api/generate-image', async (req, res) => {
  const { prompt } = req.body;

  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured on server' });
  }

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const startTime = Date.now();
  
  try {
    console.log('\n=== STARTING IMAGE GENERATION ===');
    console.log('Prompt:', prompt.substring(0, 100));
    console.log('Using gemini-2.5-flash-image-preview (same as nanobanana_generator.py)');
    console.log('⏳ This may take 30-60 seconds...');
    
    // Use the same approach as nanobanana_generator.py
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image-preview' });
    
    // Create prompt - simpler, like nanobanana_generator
    const fullPrompt = prompt;
    
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ API request completed in ${elapsed}s`);

    // Process response - exactly like nanobanana_generator.py
    const parts = response.candidates[0].content.parts;
    console.log('Response parts count:', parts.length);
    
    for (const part of parts) {
      // Check for text first (like nanobanana_generator does)
      if (part.text) {
        console.log('Text response:', part.text);
      }
      
      // Check for inline_data (binary image data) - exactly like nanobanana_generator.py
      if (part.inlineData) {
        const imageData = part.inlineData.data;
        const mimeType = part.inlineData.mimeType || 'image/png';
        
        console.log(`Found inline_data: type=${typeof imageData}, isBuffer=${Buffer.isBuffer(imageData)}, length=${imageData?.length}`);
        
        // Convert to base64 - handle both Buffer and string
        let base64Image;
        if (Buffer.isBuffer(imageData) || imageData instanceof Uint8Array) {
          // Binary data - convert to base64
          base64Image = Buffer.from(imageData).toString('base64');
        } else if (typeof imageData === 'string') {
          // Already base64 string
          base64Image = imageData;
        } else {
          // Try to convert
          base64Image = Buffer.from(imageData).toString('base64');
        }
        
        console.log(`✅ Found image data: ${base64Image.length} chars (base64), mimeType: ${mimeType}`);
        
        // Return in format expected by frontend
        return res.json({
          generatedImages: [{
            base64Image: base64Image,
            mimeType: mimeType
          }]
        });
      }
    }
    
    console.error('⚠️ No image data found in response');
    console.log('Available parts:', parts.map(p => Object.keys(p)));
    return res.status(500).json({ 
      error: 'No image data found in response',
      details: 'Response did not contain inline image data'
    });
    
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`❌ Error after ${elapsed}s:`, error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    res.status(500).json({ 
      error: 'Failed to generate image',
      details: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

