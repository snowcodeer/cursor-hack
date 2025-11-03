import { useState, useEffect } from 'react';
import './Door.css';

interface DoorProps {
  decision: string;
  isOpen: boolean;
  isFullyOpen: boolean;
  onClick: (e?: React.MouseEvent) => void;
  index: number;
  doorsVisible: boolean;
}

export default function Door({ decision, isOpen, isFullyOpen, onClick, index, doorsVisible }: DoorProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Trigger fade-in when doors should appear
  useEffect(() => {
    if (doorsVisible) {
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      // Immediately hide doors when doorsVisible is false
      setIsVisible(false);
    }
  }, [doorsVisible]);

  return (
    <div
      className={`door-container door-${index}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(e);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`door fade-in ${isVisible ? 'visible' : ''} ${isOpen && !isFullyOpen ? 'door-cracked' : ''} ${isFullyOpen ? 'door-open' : ''} ${isHovered ? 'door-hover' : ''}`}>
        <div className="door-frame">
          <div className="door-panel"></div>
        </div>
      </div>
      {(isOpen || isFullyOpen) && decision && (
        <div className={`door-decision ${(isOpen || isFullyOpen) ? 'fade-in' : ''}`}>
          <p>{decision}</p>
        </div>
      )}
    </div>
  );
}
