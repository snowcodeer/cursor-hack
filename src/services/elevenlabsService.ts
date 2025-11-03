const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Global audio manager to ensure only one instance plays at a time
class AudioManager {
  private currentAudio: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;
  private isPlaying: boolean = false;
  private isStreaming: boolean = false;

  stopCurrentAudio(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
    this.isPlaying = false;
    this.isStreaming = false;
  }

  setCurrentAudio(audio: HTMLAudioElement, url: string): void {
    this.stopCurrentAudio();
    this.currentAudio = audio;
    this.currentAudioUrl = url;
  }

  getCurrentAudio(): HTMLAudioElement | null {
    return this.currentAudio;
  }

  setPlaying(playing: boolean): void {
    this.isPlaying = playing;
  }

  getPlaying(): boolean {
    return this.isPlaying;
  }

  setStreaming(streaming: boolean): void {
    this.isStreaming = streaming;
  }

  getStreaming(): boolean {
    return this.isStreaming;
  }
}

const audioManager = new AudioManager();

export async function textToSpeechStream(
  text: string,
  voiceId: string,
  onChunk: (chunk: ArrayBuffer) => void
): Promise<void> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  if (!voiceId) {
    throw new Error('Voice ID is required');
  }

  const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5', // Use turbo model for better streaming performance
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      },
      optimize_streaming_latency: 3, // 0-4, higher = lower latency
      output_format: 'mp3_44100_128' // MP3 format for streaming
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs TTS error: ${response.statusText} - ${errorText}`);
  }

  if (!response.body) {
    throw new Error('No response body for streaming');
  }

  const reader = response.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      if (value) {
        onChunk(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function playStreamingAudio(
  onChunk: (chunk: ArrayBuffer) => void
): Promise<HTMLAudioElement> {
  const audio = new Audio();
  const mediaSource = new MediaSource();
  
  return new Promise((resolve, reject) => {
    audio.src = URL.createObjectURL(mediaSource);
    
    mediaSource.addEventListener('sourceopen', () => {
      const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
      let chunks: ArrayBuffer[] = [];
      let isAppending = false;

      const appendChunk = async () => {
        if (isAppending || chunks.length === 0) return;
        if (sourceBuffer.updating) {
          setTimeout(appendChunk, 10);
          return;
        }

        isAppending = true;
        const chunk = chunks.shift();
        if (chunk) {
          try {
            sourceBuffer.appendBuffer(chunk);
          } catch (e) {
            console.error('Error appending chunk:', e);
            isAppending = false;
          }
        } else {
          isAppending = false;
        }
      };

      sourceBuffer.addEventListener('updateend', () => {
        isAppending = false;
        appendChunk();
      });

      onChunk = (chunk: ArrayBuffer) => {
        chunks.push(chunk);
        appendChunk();
      };

      // Start playing when we have enough data
      audio.addEventListener('canplay', () => {
        if (audio.paused) {
          audio.play().catch(reject);
        }
      }, { once: true });

      audio.addEventListener('ended', () => {
        if (mediaSource.readyState === 'open') {
          mediaSource.endOfStream();
        }
        URL.revokeObjectURL(audio.src);
      });

      audio.addEventListener('error', (e) => {
        reject(new Error('Audio playback failed'));
      });

      resolve(audio);
    });

    mediaSource.addEventListener('error', reject);
  });
}

// Legacy function for non-streaming (fallback)
export async function textToSpeech(text: string, voiceId?: string): Promise<Blob> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  if (!voiceId) {
    throw new Error('Voice ID is required');
  }

  const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    })
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs TTS error: ${response.statusText}`);
  }

  return await response.blob();
}

export async function playAudio(blob: Blob): Promise<void> {
  const audioUrl = URL.createObjectURL(blob);
  const audio = new Audio(audioUrl);
  
  return new Promise((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      reject(new Error('Audio playback failed'));
    };
    audio.play();
  });
}

// Generate full audio blob (non-streaming) - waits for complete audio
export async function generateAudioBlob(text: string, voiceId: string): Promise<Blob> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  if (!voiceId) {
    throw new Error('Voice ID is required');
  }

  // Collect all chunks
  const chunks: Uint8Array[] = [];
  
  await textToSpeechStream(text, voiceId, (chunk: ArrayBuffer) => {
    chunks.push(new Uint8Array(chunk));
  });

  // Create final blob
  const blob = new Blob(chunks, { type: 'audio/mpeg' });
  return blob;
}

export async function speakText(text: string, voiceId?: string): Promise<void> {
  if (!voiceId) {
    console.error('No voice ID provided for speech');
    return;
  }
  
  // Prevent multiple concurrent calls
  if (audioManager.getStreaming() || audioManager.getPlaying()) {
    console.log('Audio already playing or streaming, stopping current audio');
    audioManager.stopCurrentAudio();
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Mark as streaming
  audioManager.setStreaming(true);
  
  // Stop any currently playing audio
  audioManager.stopCurrentAudio();
  
  try {
    console.log('Starting streaming narration with voice ID:', voiceId);
    
    // Collect chunks as they stream in
    const chunks: Uint8Array[] = [];
    let audioElement: HTMLAudioElement | null = null;
    let audioUrl: string | null = null;
    let totalBytes = 0;
    let hasStarted = false;
    const MIN_BYTES_TO_START = 8192; // 8KB for faster start
    
    // Start streaming immediately
    const streamPromise = textToSpeechStream(text, voiceId, (chunk: ArrayBuffer) => {
      const uint8Array = new Uint8Array(chunk);
      chunks.push(uint8Array);
      totalBytes += uint8Array.length;
      
      // Start playing when we have enough data buffered
      if (!audioElement && totalBytes >= MIN_BYTES_TO_START) {
        const blob = new Blob(chunks, { type: 'audio/mpeg' });
        audioUrl = URL.createObjectURL(blob);
        audioElement = new Audio(audioUrl);
        audioManager.setCurrentAudio(audioElement, audioUrl);
        
        // Wait for enough data to be buffered before playing to avoid stuttering
        const tryPlay = () => {
          if (!hasStarted && audioManager.getStreaming() && audioElement) {
            hasStarted = true;
            audioElement.play().then(() => {
              audioManager.setPlaying(true);
              audioManager.setStreaming(false);
            }).catch(err => {
              console.error('Error starting audio playback:', err);
              audioManager.setStreaming(false);
              hasStarted = false; // Reset to try again
            });
          }
        };
        
        audioElement.addEventListener('canplaythrough', tryPlay, { once: true });
        
        // Fallback: if canplaythrough doesn't fire, use canplay with delay
        audioElement.addEventListener('canplay', () => {
          if (!hasStarted && audioManager.getStreaming()) {
            setTimeout(tryPlay, 200); // Wait 200ms for more buffering
          }
        }, { once: true });
        
        audioElement.addEventListener('ended', () => {
          audioManager.stopCurrentAudio();
        }, { once: true });
        
        audioElement.addEventListener('error', (e) => {
          console.error('Audio error:', e);
          audioManager.stopCurrentAudio();
        }, { once: true });
        
        // Load the audio
        audioElement.load();
        
        // Fallback: if events don't fire, try playing after a short delay
        setTimeout(() => {
          if (!hasStarted && audioElement && audioElement.readyState >= 2) {
            tryPlay();
          }
        }, 500);
      }
    });
    
    // Wait for streaming to complete
    await streamPromise;
    
    // Create final blob with all chunks
    const finalBlob = new Blob(chunks, { type: 'audio/mpeg' });
    
    if (!audioElement) {
      // If no audio element was created (stream was too short), create one now
      const finalUrl = URL.createObjectURL(finalBlob);
      audioElement = new Audio(finalUrl);
      audioManager.setCurrentAudio(audioElement, finalUrl);
      audioElement.load();
      
      audioElement.addEventListener('canplaythrough', () => {
        if (!hasStarted && audioManager.getStreaming()) {
          hasStarted = true;
          audioElement?.play().then(() => {
            audioManager.setPlaying(true);
            audioManager.setStreaming(false);
          });
        }
      }, { once: true });
      
      // Fallback
      setTimeout(() => {
        if (!hasStarted && audioElement && audioElement.readyState >= 2) {
          hasStarted = true;
          audioElement.play().then(() => {
            audioManager.setPlaying(true);
            audioManager.setStreaming(false);
          });
        }
      }, 300);
    } else if (!hasStarted && audioElement.paused) {
      // Update to final blob if audio hasn't started yet
      const finalUrl = URL.createObjectURL(finalBlob);
      audioElement.src = finalUrl;
      if (audioUrl && audioUrl !== finalUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      audioUrl = finalUrl;
      audioManager.setCurrentAudio(audioElement, finalUrl);
      audioElement.load();
      
      audioElement.addEventListener('canplaythrough', () => {
        if (!hasStarted && audioManager.getStreaming()) {
          hasStarted = true;
          audioElement?.play().then(() => {
            audioManager.setPlaying(true);
            audioManager.setStreaming(false);
          });
        }
      }, { once: true });
      
      // Fallback
      setTimeout(() => {
        if (!hasStarted && audioElement && audioElement.readyState >= 2) {
          hasStarted = true;
          audioElement.play().then(() => {
            audioManager.setPlaying(true);
            audioManager.setStreaming(false);
          });
        }
      }, 300);
    }
    
    // Wait for audio to finish
    return new Promise((resolve, reject) => {
      if (!audioElement) {
        resolve();
        return;
      }
      
      const cleanup = () => {
        audioManager.stopCurrentAudio();
      };
      
      audioElement.addEventListener('ended', () => {
        cleanup();
        resolve();
      }, { once: true });
      
      audioElement.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        cleanup();
        reject(new Error('Audio playback failed'));
      }, { once: true });
    });
  } catch (error) {
    console.error('Error speaking text:', error);
    audioManager.stopCurrentAudio();
    audioManager.setStreaming(false);
    throw error;
  }
}

// Speech-to-Text using browser Web Speech API (ElevenLabs STT may require different implementation)
export class SpeechToText {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private onResultCallback?: (text: string) => void;
  private onErrorCallback?: (error: string) => void;

  constructor() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (this.onResultCallback) {
          this.onResultCallback(transcript);
        }
      };

      this.recognition.onerror = (event) => {
        if (this.onErrorCallback) {
          this.onErrorCallback(event.error);
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
      };
    }
  }

  start(onResult: (text: string) => void, onError?: (error: string) => void): void {
    if (!this.recognition) {
      onError?.('Speech recognition not supported in this browser');
      return;
    }

    this.onResultCallback = onResult;
    this.onErrorCallback = onError;

    if (!this.isListening) {
      this.isListening = true;
      this.recognition.start();
    }
  }

  stop(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  isAvailable(): boolean {
    return this.recognition !== null;
  }
}
