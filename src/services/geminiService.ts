const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImage';

export async function generateImage(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  try {
    // Try Gemini Imagen API first
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        number_of_images: 1,
        aspect_ratio: '16:9'
      })
    });

    if (!response.ok) {
      // If Imagen fails, try text-to-image alternative
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.generatedImages && data.generatedImages.length > 0) {
      return data.generatedImages[0].imageBytes || data.generatedImages[0].base64Image;
    }

    // Fallback: use a placeholder or alternative API
    throw new Error('No image generated');
  } catch (error) {
    console.error('Error generating image with Gemini:', error);
    
    // Alternative: Use a placeholder service or return a data URL
    // For now, we'll throw so the UI can handle it gracefully
    throw new Error('Image generation failed. Please check your API key and try again.');
  }
}

// Helper to convert base64 to data URL if needed
export function imageToDataUrl(imageData: string, isBase64: boolean = true): string {
  if (isBase64) {
    // Check if it already has data URL prefix
    if (imageData.startsWith('data:')) {
      return imageData;
    }
    return `data:image/png;base64,${imageData}`;
  }
  return imageData;
}
