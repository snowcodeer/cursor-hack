import { useEffect, useState, useRef, useCallback } from 'react';
import { useGame } from '../contexts/GameContext';
import { generateDecisions } from '../services/openaiService';
import Door from './Door';
import HistoryView from './HistoryView';
import './StoryView.css';

interface StoryViewProps {
  fullyOpenDoor: number | null;
  setFullyOpenDoor: (index: number | null) => void;
  decisions: string[];
  setDecisions: (decisions: string[]) => void;
}

export default function StoryView({ fullyOpenDoor, setFullyOpenDoor, decisions, setDecisions }: StoryViewProps) {
  const { storyState, makeDecision, phase, isGeneratingImage, testImage } = useGame();
  const [showImageModal, setShowImageModal] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(true);
  const [doorsVisible, setDoorsVisible] = useState(false);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [isGeneratingDecisions, setIsGeneratingDecisions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wordTimersRef = useRef<number[]>([]);
  const lastStoryRef = useRef<string>('');
  const lastAudioUrlRef = useRef<string | null>(null);
  const timeUpdateHandlerRef = useRef<((e: Event) => void) | null>(null);

  const generateDecisionOptions = useCallback(async () => {
    if (!storyState?.currentStory || isGeneratingDecisions) return;

    setIsGeneratingDecisions(true);
    try {
      const generatedDecisions = await generateDecisions(storyState.currentStory);
      setDecisions([...generatedDecisions, 'Make your own decision']);
    } catch (error) {
      console.error('Error generating decisions:', error);
      setDecisions([
        'Take the path through the darkness',
        'Stay and search for another way',
        'Make your own decision'
      ]);
    } finally {
      setIsGeneratingDecisions(false);
    }
  }, [storyState?.currentStory, isGeneratingDecisions, setDecisions]);

  // Reset refs when phase changes to 'story' (especially when coming from 'ending' phase)
  useEffect(() => {
    if (phase === 'story') {
      // Clear refs when entering story phase to ensure replay is recognized as new
      lastStoryRef.current = '';
      lastAudioUrlRef.current = null;
    }
  }, [phase]);

  useEffect(() => {
    if (!storyState) return;

    const storyText = storyState.currentStory;
    const audioUrl = storyState.audioUrl;
    
    if (!storyText) return;
    
    // Check if this is a new segment
    const isNewSegment = storyText !== lastStoryRef.current || audioUrl !== lastAudioUrlRef.current;
    
    console.log('StoryView useEffect:', {
      storyText: storyText.substring(0, 50),
      hasAudioUrl: !!audioUrl,
      isNewSegment,
      isFading,
      lastStory: lastStoryRef.current?.substring(0, 50)
    });
    
    if (!isNewSegment) {
      console.log('Same segment, skipping');
      return; // Same segment, don't re-play
    }

    // If no audioUrl, show text word-by-word without audio synchronization
    if (!audioUrl) {
      console.log('No audio URL, displaying text word-by-word');
      // Clean up previous state
      wordTimersRef.current.forEach(timer => clearTimeout(timer));
      wordTimersRef.current = [];
      if (audioRef.current) {
        if (timeUpdateHandlerRef.current) {
          audioRef.current.removeEventListener('timeupdate', timeUpdateHandlerRef.current);
          timeUpdateHandlerRef.current = null;
        }
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Reset for fresh segment
      setDisplayedText('');
      setIsStreaming(true);
      setDoorsVisible(false);
      setDoorsOpen(false);
      setDecisions([]);
      setFullyOpenDoor(null);
      lastStoryRef.current = storyText;
      lastAudioUrlRef.current = null;

      // Split text into words (preserving whitespace and newlines)
      const words = storyText.split(/(\s+|\n)/).filter(word => word.length > 0);
      
      // Display text word by word without audio sync
      let displayedIndex = 0;
      const displayNextWord = () => {
        if (displayedIndex < words.length) {
          // Show text up to and including current word
          let textToShow = '';
          for (let i = 0; i <= displayedIndex; i++) {
            textToShow += words[i];
          }
          setDisplayedText(textToShow);
          displayedIndex++;
          
          // Continue with next word
          const timer = setTimeout(displayNextWord, 100); // 100ms per word
          wordTimersRef.current.push(timer);
        } else {
          // All words displayed
          setIsStreaming(false);
          setTimeout(() => {
            setDoorsVisible(true);
            setTimeout(() => {
              setDoorsOpen(true);
              generateDecisionOptions();
            }, 300);
          }, 400);
        }
      };
      
      displayNextWord();
      return;
    }

    // If we're fading, wait for fade to complete before processing new content
    // But we need to clear lastStoryRef so it recognizes the new story after fade
    if (isFading) {
      console.log('Fading, clearing refs and will process story after fade completes');
      // Clear refs so new story is recognized after fade
      lastStoryRef.current = '';
      lastAudioUrlRef.current = null;
      
      // Fade duration is 1s, wait for it to complete then process
      const fadeCompleteTimer = setTimeout(() => {
        setIsFading(false);
        // The useEffect will run again when isFading becomes false
        // and process the story then (with cleared refs, it will recognize as new)
      }, 1000); // Fade duration
      
      return () => clearTimeout(fadeCompleteTimer);
    }

    // Clean up previous audio and timers
    if (audioRef.current) {
      // Stop previous audio when starting new segment
      if (timeUpdateHandlerRef.current) {
        audioRef.current.removeEventListener('timeupdate', timeUpdateHandlerRef.current);
        timeUpdateHandlerRef.current = null;
      }
      audioRef.current.pause();
      audioRef.current = null;
    }
    wordTimersRef.current.forEach(timer => clearTimeout(timer));
    wordTimersRef.current = [];

    // Reset everything for fresh segment
    // Keep doors hidden - they'll appear after text finishes
    setDisplayedText('');
    setIsStreaming(true);
    setDoorsVisible(false); // Start hidden
    setDoorsOpen(false); // Start closed
    setDecisions([]);
    setFullyOpenDoor(null);
    lastStoryRef.current = storyText;
    lastAudioUrlRef.current = audioUrl;

    // Split text into words (preserving whitespace and newlines)
    const words = storyText.split(/(\s+|\n)/).filter(word => word.length > 0);
    
    // Count only actual words (not whitespace/newlines) for timing
    const actualWords = words.filter(word => !/^\s+$/.test(word) && word !== '\n');
    const wordCount = actualWords.length;

    // Create audio element and load it
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    // Wait for audio to be loaded and get duration
    const setupAndPlay = () => {
      if (!audio.duration || isNaN(audio.duration)) {
        // Audio duration not ready yet, try again
        setTimeout(setupAndPlay, 100);
        return;
      }

      const audioDuration = audio.duration; // Duration in seconds

      // Calculate word timing positions
      // Show text synchronized with audio - use 75% of audio duration for good sync
      const textDisplayDuration = audioDuration * 0.75;
      const wordTimings: { arrayIndex: number; time: number }[] = [];
      let wordIndex = 0;
      
      words.forEach((word, arrayIndex) => {
        const isWhitespace = /^\s+$/.test(word);
        const isNewline = word === '\n';
        
        if (!isWhitespace && !isNewline) {
          // Distribute words across the faster display duration
          const wordStartTime = (wordIndex / wordCount) * textDisplayDuration;
          wordTimings.push({ arrayIndex, time: wordStartTime });
          wordIndex++;
        }
      });

      // Start audio playback and sync with timeupdate
      const playPromise = audio.play().catch(error => {
        console.error('Error playing audio:', error);
        // Fallback: show all text immediately if audio fails
        setDisplayedText(storyText);
        setIsStreaming(false);
        setDoorsVisible(true);
        setTimeout(() => {
          setDoorsOpen(true);
          generateDecisionOptions();
        }, 300);
      });

      // Once audio starts, use timeupdate for accurate synchronization
      playPromise.then(() => {
        let currentWordIndex = 0;
        
        // Show first word immediately
        if (wordTimings.length > 0) {
          const firstTiming = wordTimings[0];
          let textToShow = '';
          for (let i = 0; i <= firstTiming.arrayIndex; i++) {
            textToShow += words[i];
          }
          setDisplayedText(textToShow);
          currentWordIndex = 1;
        }

        // Use timeupdate event to sync with audio playback
        const timeUpdateHandler = () => {
          const currentTime = audio.currentTime;
          
          // Show words that should have appeared by now
          while (currentWordIndex < wordTimings.length) {
            const timing = wordTimings[currentWordIndex];
            if (currentTime >= timing.time) {
              // Show text up to and including this word
              let textToShow = '';
              for (let i = 0; i <= timing.arrayIndex; i++) {
                textToShow += words[i];
              }
              setDisplayedText(textToShow);
              
              // If this is the last word, mark streaming as complete
              if (currentWordIndex === wordTimings.length - 1) {
                setIsStreaming(false);
                
                // Wait for fade-in animation to complete, then show doors
                const totalAnimationTime = (timing.arrayIndex * 0.05) + 0.4 + 0.2;
                setTimeout(() => {
                  setDoorsVisible(true);
                  setTimeout(() => {
                    setDoorsOpen(true);
                    generateDecisionOptions();
                  }, 300);
                }, totalAnimationTime * 1000);
                
                // Don't stop listening to timeupdate - let audio continue playing
                // We'll only remove the listener when audio ends or new segment starts
              }
              
              currentWordIndex++;
            } else {
              break;
            }
          }
        };

        timeUpdateHandlerRef.current = timeUpdateHandler;
        audio.addEventListener('timeupdate', timeUpdateHandler);
        
        // Clean up listener on audio end
        audio.addEventListener('ended', () => {
          if (timeUpdateHandlerRef.current) {
            audio.removeEventListener('timeupdate', timeUpdateHandlerRef.current);
            timeUpdateHandlerRef.current = null;
          }
          // Ensure all text is displayed
          setDisplayedText(storyText);
          setIsStreaming(false);
          console.log('Audio playback completed');
        }, { once: true });
      });
    };

    // Wait for audio to load
    audio.addEventListener('loadedmetadata', setupAndPlay, { once: true });
    audio.load();

    // Cleanup
    return () => {
      if (audioRef.current) {
        if (timeUpdateHandlerRef.current) {
          audioRef.current.removeEventListener('timeupdate', timeUpdateHandlerRef.current);
          timeUpdateHandlerRef.current = null;
        }
        // Pause audio when component unmounts or new segment starts
        audioRef.current.pause();
        audioRef.current = null;
      }
      wordTimersRef.current.forEach(timer => clearTimeout(timer));
      wordTimersRef.current = [];
    };
  }, [storyState?.currentStory, storyState?.audioUrl, generateDecisionOptions, isFading]);

  const handleDoorClick = (decision: string) => {
    console.log('Door clicked with decision:', decision);
    if (decision === 'Make your own decision') {
      // Let user input their own decision via chat
      return;
    }
    
    if (!decision || !decision.trim()) {
      console.error('Empty decision, cannot proceed');
      return;
    }
    
    // Pass available options to makeDecision so they can be stored in the tree
    const availableOptions = decisions.filter(d => d !== 'Make your own decision');
    
    // Start generation immediately - don't await, let it run in background
    // Door opening animation (2s) provides visual buffer while generation happens
    console.log('Starting makeDecision (generation begins immediately)...');
    makeDecision(decision, availableOptions).catch(error => {
      console.error('Error making decision:', error);
    });
    // Don't reset doors immediately - let the door stay open
    // The doors will reset naturally when new story segment arrives
  };

  // Trigger fade to black when door is fully open
  useEffect(() => {
    if (fullyOpenDoor !== null && !isFading) {
      console.log('Door fully open, starting fade to black in 2s...');
      // Wait for door opening animation to complete (2s), then fade to black
      const fadeTimer = setTimeout(() => {
        console.log('Starting fade to black');
        setIsFading(true);
      }, 2000); // Match door opening animation duration
      
      return () => clearTimeout(fadeTimer);
    }
  }, [fullyOpenDoor, isFading]);

  // Trigger fade-out when endStory is called (detect via isGeneratingImage becoming true)
  useEffect(() => {
    if (isGeneratingImage && phase === 'story' && !isFadingOut) {
      setIsFadingOut(true);
    }
  }, [isGeneratingImage, phase]);

  // Show image modal when test image is generated
  useEffect(() => {
    if (testImage) {
      setShowImageModal(true);
    }
  }, [testImage]);

  if (!storyState) {
    return null;
  }

  // Split displayed text into words for word-by-word fade-in
  // Split by spaces and newlines, keeping the separators
  const words = displayedText.split(/(\s+|\n)/).filter(word => word.length > 0);
  
  return (
    <div className={`story-view ${isFading ? 'fading' : ''} ${isFadingOut ? 'fading-out' : ''}`}>
      {isFading && <div className="fade-overlay"></div>}
      {isFadingOut && (
        <>
          <div className="fade-overlay fade-out"></div>
          {isGeneratingImage && (
            <div className="ending-loading-overlay">
              <div className="loading-spinner"></div>
              <p className="loading-text">Generating your story ending...</p>
            </div>
          )}
        </>
      )}
      <button className="history-button" onClick={() => setShowHistory(true)} title="View Story History">
        📜
      </button>
      
      {showHistory && <HistoryView onClose={() => setShowHistory(false)} />}
      
      {/* Test Image Modal */}
      {showImageModal && testImage && (
        <div className="image-modal-overlay" onClick={() => setShowImageModal(false)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="image-modal-close" onClick={() => setShowImageModal(false)}>×</button>
            {isGeneratingImage ? (
              <div className="image-modal-loading">
                <div className="loading-spinner"></div>
                <p>Generating image...</p>
              </div>
            ) : (
              <img src={testImage} alt="Generated test image" className="test-image" />
            )}
          </div>
        </div>
      )}
      
      <div className="story-content">
        <div ref={textRef} className="story-text">
          {words.map((word, index) => {
            const isWhitespace = /^\s+$/.test(word);
            const isNewline = word === '\n';
            
            return (
              <span
                key={`${index}-${word.slice(0, 10)}`}
                className={isWhitespace || isNewline ? "story-whitespace" : "story-word"}
                style={!isWhitespace && !isNewline ? { animationDelay: `${index * 0.05}s` } : {}}
              >
                {isNewline ? <br /> : word}
              </span>
            );
          })}
        </div>

        <div className={`doors-container ${doorsVisible ? 'visible' : ''}`}>
          {[0, 1, 2].map((index) => (
            <Door
              key={index}
              index={index}
              decision={decisions[index] || ''}
              isOpen={doorsOpen && decisions.length > index}
              isFullyOpen={fullyOpenDoor === index}
              doorsVisible={doorsVisible}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Door container clicked, index:', index, 'decision:', decisions[index]);
                if (decisions[index] && decisions[index] !== 'Make your own decision') {
                  // Start door opening animation immediately
                  setFullyOpenDoor(index);
                  
                  // Start generation immediately in background
                  // Door opening animation acts as buffer while generation happens
                  handleDoorClick(decisions[index]);
                } else {
                  console.log('No decision or is "Make your own decision"');
                }
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
