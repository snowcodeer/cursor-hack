// Animation utility functions and constants

export const ANIMATION_DURATIONS = {
  FAST: 0.2,
  MEDIUM: 0.5,
  SLOW: 1.0,
};

export const ANIMATION_EASINGS = {
  EASE_IN: 'ease-in',
  EASE_OUT: 'ease-out',
  EASE_IN_OUT: 'ease-in-out',
};

// Helper to create fade-in animation styles
export function createFadeInStyle(duration: number = ANIMATION_DURATIONS.MEDIUM) {
  return {
    animation: `fadeIn ${duration}s ${ANIMATION_EASINGS.EASE_IN}`,
  };
}

// Helper to create slide-up animation styles
export function createSlideUpStyle(duration: number = ANIMATION_DURATIONS.MEDIUM) {
  return {
    animation: `slideUp ${duration}s ${ANIMATION_EASINGS.EASE_OUT}`,
  };
}

// Stream text with fade-in effect
export async function streamTextWithAnimation(
  text: string,
  callback: (char: string, index: number) => void,
  speed: number = 30
): Promise<void> {
  return new Promise((resolve) => {
    let index = 0;
    const stream = () => {
      if (index < text.length) {
        callback(text[index], index);
        index++;
        setTimeout(stream, speed);
      } else {
        resolve();
      }
    };
    stream();
  });
}

