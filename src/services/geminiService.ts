// Use backend proxy endpoint to avoid CORS issues
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export async function generateImage(prompt: string): Promise<string> {
  try {
    // Call backend proxy endpoint instead of direct API call
    const response = await fetch(`${API_BASE_URL}/api/generate-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Frontend: Gemini API response structure:', {
      hasGeneratedImages: !!data.generatedImages,
      generatedImagesLength: data.generatedImages?.length,
      firstImageKeys: data.generatedImages?.[0] ? Object.keys(data.generatedImages[0]) : null,
      rootKeys: Object.keys(data)
    });
    
    // Gemini Imagen API can return different formats:
    // 1. { generatedImages: [{ base64Image: "...", mimeType: "..." }] }
    // 2. { generatedImages: [{ imageBytes: "..." }] }
    // 3. { generatedImages: [{ imageUri: "https://..." }] } - signed URL
    if (data.generatedImages && data.generatedImages.length > 0) {
      const imageData = data.generatedImages[0];
      console.log('Frontend: First image object keys:', Object.keys(imageData));
      
      // Check for imageUri (signed URL) - might be what Gemini returns
      if (imageData.imageUri) {
        console.log('Found imageUri (URL):', imageData.imageUri);
        return imageData.imageUri; // Return URL directly
      }
      
      // Check for base64Image (most common format)
      if (imageData.base64Image) {
        console.log('Found base64Image, length:', imageData.base64Image.length);
        return imageData.base64Image;
    }

      // Check for imageBytes (alternative format)
      if (imageData.imageBytes) {
        console.log('Found imageBytes, length:', imageData.imageBytes.length);
        return imageData.imageBytes;
      }
      
      // Check for bytes (alternative naming)
      if (imageData.bytes) {
        console.log('Found bytes, length:', imageData.bytes.length);
        return imageData.bytes;
      }
      
      // Check for imageBase64 (alternative naming)
      if (imageData.imageBase64) {
        console.log('Found imageBase64, length:', imageData.imageBase64.length);
        return imageData.imageBase64;
      }
      
      // Check for direct image field
      if (imageData.image) {
        console.log('Found image field, length:', imageData.image.length);
        return imageData.image;
      }
      
      console.error('Image object found but no recognized image data field. Available fields:', Object.keys(imageData));
      // Log all field values for debugging
      Object.keys(imageData).forEach(key => {
        const value = imageData[key];
        if (typeof value === 'string') {
          console.log(`  ${key}: "${value.substring(0, 100)}..." (length: ${value.length})`);
        } else {
          console.log(`  ${key}:`, value);
        }
      });
    }
    
    // If response has a direct imageBytes/base64Image at root (less common)
    if (data.imageBytes) {
      console.log('Found imageBytes at root, length:', data.imageBytes.length);
      return data.imageBytes;
    }
    
    if (data.base64Image) {
      console.log('Found base64Image at root, length:', data.base64Image.length);
      return data.base64Image;
    }
    
    if (data.imageUri) {
      console.log('Found imageUri at root:', data.imageUri);
      return data.imageUri;
    }

    // Fallback: log the full response structure for debugging
    console.error('No image found in response. Full response structure:', JSON.stringify(data, null, 2).substring(0, 2000));
    throw new Error('No image generated - check API response format. See console for details.');
  } catch (error) {
    console.error('Error generating image with Gemini:', error);
    
    // Alternative: Use a placeholder service or return a data URL
    // For now, we'll throw so the UI can handle it gracefully
    throw new Error(error instanceof Error ? error.message : 'Image generation failed. Please check your API key and try again.');
  }
}

// Helper to convert base64 to data URL if needed
export function imageToDataUrl(imageData: string, isBase64: boolean = true): string {
  if (!imageData) {
    console.error('Empty image data');
    return '';
  }
  
    // Check if it already has data URL prefix
    if (imageData.startsWith('data:')) {
      return imageData;
    }
  
  // Check if it's a URL (including signed URLs from Google Cloud Storage)
  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    console.log('Image data is a URL, returning directly:', imageData.substring(0, 100));
    return imageData;
  }
  
  // Check if it's a Google Cloud Storage gs:// URI (convert to https)
  if (imageData.startsWith('gs://')) {
    // This would need special handling - for now just return as-is
    console.log('Image data is a gs:// URI:', imageData);
    return imageData;
  }
  
  // Handle base64 data
  if (isBase64) {
    // Remove any whitespace/newlines
    const cleanData = imageData.trim().replace(/\s/g, '');
    
    // Detect image format from base64 data
    // PNG: starts with iVBORw0KGgo
    // JPEG: starts with /9j/
    // WebP: starts with UklGR
    let mimeType = 'image/png'; // Default to PNG for Imagen
    
    if (cleanData.startsWith('iVBORw0KGgo')) {
      mimeType = 'image/png';
    } else if (cleanData.startsWith('/9j/')) {
      mimeType = 'image/jpeg';
    } else if (cleanData.startsWith('UklGR')) {
      mimeType = 'image/webp';
    } else if (cleanData.startsWith('R0lGODlh') || cleanData.startsWith('R0lGODdh')) {
      mimeType = 'image/gif';
    }
    
    // Validate base64 data
    if (cleanData.length === 0) {
      console.error('Empty base64 data after cleaning');
      throw new Error('Invalid base64 image data: empty');
    }
    
    // Check if it looks like valid base64
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(cleanData)) {
      console.error('Data does not match base64 pattern');
      console.log('First 100 chars:', cleanData.substring(0, 100));
      throw new Error('Invalid base64 image data: invalid characters');
    }
    
    console.log('Converting to data URL with mimeType:', mimeType, 'data length:', cleanData.length);
    const dataUrl = `data:${mimeType};base64,${cleanData}`;
    console.log('Data URL created, total length:', dataUrl.length);
    return dataUrl;
  }
  
  return imageData;
}
