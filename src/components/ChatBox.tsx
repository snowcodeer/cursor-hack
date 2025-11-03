import { useState, useEffect, useRef } from 'react';
import { useGame } from '../contexts/GameContext';
import { SpeechToText } from '../services/elevenlabsService';
import './ChatBox.css';

interface ChatBoxProps {
  onInputMatch?: (matchedIndex: number | null) => void;
  decisions?: string[];
}

export default function ChatBox({ onInputMatch, decisions }: ChatBoxProps) {
  const { makeDecision, endStory, phase } = useGame();
  const [textInputEnabled, setTextInputEnabled] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechToText, setSpeechToText] = useState<SpeechToText | null>(null);

  const findMatchingDoor = (input: string): number | null => {
    if (!decisions || decisions.length === 0) return null;
    const lowerInput = input.toLowerCase().trim();
    const matchIndex = decisions.findIndex((decision, index) => {
      if (index === decisions.length - 1 && decision === 'Make your own decision') return false;
      const lowerDecision = decision.toLowerCase();
      return lowerDecision.includes(lowerInput) || lowerInput.includes(lowerDecision);
    });
    return matchIndex >= 0 ? matchIndex : null;
  };

  useEffect(() => {
    const stt = new SpeechToText();
    setSpeechToText(stt);
    
    return () => {
      stt.stop();
    };
  }, []);


  const isEndStoryCommand = (text: string): boolean => {
    const lowerText = text.toLowerCase().trim();
    const endCommands = ['end story', 'end the story', 'finish story', 'conclude story', 'story over'];
    return endCommands.some(cmd => lowerText.includes(cmd) || lowerText === cmd.slice(0, -7));
  };

  const handleToggleTextInput = () => {
    setTextInputEnabled(!textInputEnabled);
    if (isListening) {
      handleStopListening();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const inputText = inputValue.trim();

    // Check if user wants to end the story
    if (phase === 'story' && isEndStoryCommand(inputText)) {
      endStory();
      setInputValue('');
      if (onInputMatch) onInputMatch(null);
      return;
    }

    // If we're in story phase and user typed something, treat it as a decision
    if (phase === 'story') {
      makeDecision(inputText);
      setInputValue('');
      if (onInputMatch) onInputMatch(null);
    }
    
    setInputValue('');
  };

  const handleStartListening = () => {
    if (!speechToText || !speechToText.isAvailable()) {
      alert('Speech recognition is not available in your browser');
      return;
    }

    setIsListening(true);
    speechToText.start(
      (text) => {
        setIsListening(false);
        
        // Check if user wants to end the story
        if (phase === 'story' && isEndStoryCommand(text)) {
          endStory();
          return;
        }
        
        // If in story phase, automatically make decision
        if (phase === 'story') {
          makeDecision(text);
          if (onInputMatch) onInputMatch(null);
        }
      },
      (error) => {
        console.error('Speech recognition error:', error);
        setIsListening(false);
        alert('Speech recognition error: ' + error);
      }
    );
  };

  const handleStopListening = () => {
    if (speechToText) {
      speechToText.stop();
    }
    setIsListening(false);
  };

  if (phase === 'landing' || phase === 'ending') {
    return null;
  }

  return (
    <div className="chat-box">
      <div className="chat-input-container">
        <button
          className={`chat-toggle ${textInputEnabled ? 'active' : ''}`}
          onClick={handleToggleTextInput}
          title={textInputEnabled ? 'Disable text input' : 'Enable text input'}
        >
          ⌨️
        </button>

        {textInputEnabled ? (
          <form onSubmit={handleSubmit} className="chat-form">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                // Don't match on typing - only on click or submit
              }}
              placeholder="Type your decision or say 'end story'..."
              className="chat-input"
            />
            <button type="submit" className="chat-submit">
              Send
            </button>
          </form>
        ) : (
          <div className="voice-input-container">
            {!isListening ? (
              <button
                className="voice-button"
                onClick={handleStartListening}
                title="Start voice input - say your decision or 'end story'"
              >
                🎤 Click to Speak
              </button>
            ) : (
              <button
                className="voice-button listening"
                onClick={handleStopListening}
                title="Stop listening"
              >
                ⏹️ Listening...
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
