import { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import './LandingPage.css';

const RANDOM_PROMPTS = [
  'A mysterious key found in an abandoned lighthouse',
  'The last letter from someone who disappeared',
  'A door that appears only at midnight',
  'An old photograph that shows something impossible',
  'A voice from a radio that stopped working years ago',
  'A map leading to a place that doesn\'t exist',
  'A mirror that reflects a different world',
  'A clock that runs backwards',
];

export default function LandingPage() {
  const { startStory } = useGame();
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');

  const handleRandom = () => {
    const randomPrompt = RANDOM_PROMPTS[Math.floor(Math.random() * RANDOM_PROMPTS.length)];
    startStory(randomPrompt);
  };

  const handleCustom = () => {
    setShowCustomModal(true);
  };

  const handleSubmitCustom = () => {
    if (customPrompt.trim()) {
      startStory(customPrompt.trim());
      setShowCustomModal(false);
      setCustomPrompt('');
    }
  };

  const handleCloseModal = () => {
    setShowCustomModal(false);
    setCustomPrompt('');
  };

  return (
    <div className="landing-page">
      <div className="landing-content">
        <h1 className="landing-title">Welcome to the Story Chamber</h1>
        <div className="landing-buttons">
          <button className="landing-button" onClick={handleRandom}>
            Random
          </button>
          <button className="landing-button" onClick={handleCustom}>
            Custom
          </button>
        </div>
      </div>

      {showCustomModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={handleCloseModal}>×</button>
            <h2 className="modal-title">Create Your Story</h2>
            <p className="modal-subtitle">Enter a prompt or theme to begin your narrative</p>
            <textarea
              className="modal-input"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g., A forgotten diary reveals secrets about the old mansion..."
              rows={5}
            />
            <button
              className="modal-submit"
              onClick={handleSubmitCustom}
              disabled={!customPrompt.trim()}
            >
              Begin Story
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
