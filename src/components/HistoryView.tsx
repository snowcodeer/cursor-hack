import { useGame } from '../contexts/GameContext';
import './HistoryView.css';

export default function HistoryView({ onClose }: { onClose: () => void }) {
  const { storyState } = useGame();

  if (!storyState) {
    return null;
  }

  const fullStory = storyState.fullHistory.join('\n\n');

  return (
    <div className="history-overlay" onClick={onClose}>
      <div className="history-content" onClick={(e) => e.stopPropagation()}>
        <button className="history-close" onClick={onClose}>×</button>
        <h2 className="history-title">Story History</h2>
        <div className="history-text">
          {storyState.fullHistory.map((segment, index) => (
            <div key={index} className="history-segment">
              {segment}
              {index < storyState.fullHistory.length - 1 && (
                <div className="history-divider">
                  {storyState.decisions[index] && (
                    <span className="history-decision">
                      → {storyState.decisions[index].text}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

