// Browser-based speech recognition wrapper
export class SpeechRecognitionWrapper {
  private recognition: any;
  private isListening: boolean = false;

  constructor() {
    if ('webkitSpeechRecognition' in window) {
      // @ts-ignore
      this.recognition = new webkitSpeechRecognition();
    } else if ('SpeechRecognition' in window) {
      // @ts-ignore
      this.recognition = new SpeechRecognition();
    } else {
      throw new Error('Speech recognition not supported in this browser');
    }

    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
  }

  start(
    onResult: (text: string) => void,
    onError?: (error: Error) => void
  ): void {
    if (this.isListening) {
      return;
    }

    this.isListening = true;

    this.recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      this.isListening = false;
    };

    this.recognition.onerror = (event: any) => {
      this.isListening = false;
      if (onError) {
        onError(new Error(`Speech recognition error: ${event.error}`));
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
    };

    this.recognition.start();
  }

  stop(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  isActive(): boolean {
    return this.isListening;
  }
}

// Helper function to check if speech recognition is available
export const isSpeechRecognitionAvailable = (): boolean => {
  return (
    'webkitSpeechRecognition' in window ||
    'SpeechRecognition' in window
  );
};

