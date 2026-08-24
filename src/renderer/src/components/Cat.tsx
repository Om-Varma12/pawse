import React, { useState, useEffect, useRef } from 'react';

interface CatStateData {
  phrase?: string;
}

interface CatState {
  state: 'idle' | 'walk' | 'sit' | 'notice' | 'approach' | 'swat' | 'cute' | 'disappointed' | 'angry' | 'happy' | 'pet';
  data?: CatStateData;
}

const Cat: React.FC = () => {
  const [catState, setCatState] = useState<CatState>({ state: 'idle' });
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const nextHeartId = useRef(0);
  const dragStart = useRef({ x: 0, y: 0 });
  const totalDragDist = useRef(0);
  const isMouseDown = useRef(false);

  useEffect(() => {
    // Listen for state changes from main process
    const handleCatState = (_event: any, data: CatState) => {
      setCatState(data);
    };

    window.electron.ipcRenderer.on('cat:state', handleCatState);
    return () => {
      window.electron.ipcRenderer.removeAllListeners('cat:state');
    };
  }, []);

  // Handle petting / love emoji animation
  useEffect(() => {
    if (catState.state === 'pet') {
      const id = nextHeartId.current++;
      // Spawn heart near the top of the cat
      setHearts((prev) => [...prev, { id, x: 120 + (Math.random() * 20 - 10), y: 40 }]);
      
      // Cleanup heart after animation
      setTimeout(() => {
        setHearts((prev) => prev.filter((h) => h.id !== id));
      }, 1500);
    }
  }, [catState.state]);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragStart.current = { x: e.screenX, y: e.screenY };
    totalDragDist.current = 0;
    isMouseDown.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current) return;
    const dx = e.screenX - dragStart.current.x;
    const dy = e.screenY - dragStart.current.y;
    totalDragDist.current += Math.sqrt(dx * dx + dy * dy);
    dragStart.current = { x: e.screenX, y: e.screenY };
    window.electron.ipcRenderer.send('drag-window', { dx, dy });
  };

  const handleMouseUp = () => {
    isMouseDown.current = false;
    if (totalDragDist.current < 5) {
      // Small movement is treated as clicking/petting the cat
      window.electron.ipcRenderer.send('cat:pet');
    }
  };

  const handleMouseEnterCat = () => {
    // Tell electron to capture mouse events when hovering over the cat body
    window.electron.ipcRenderer.send('set-ignore-mouse-events', false);
  };

  const handleMouseLeaveCat = () => {
    // Let mouse clicks pass through transparent area of the window
    window.electron.ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
  };

  return (
    <div 
      className="cat-container"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        isMouseDown.current = false;
        handleMouseLeaveCat();
      }}
    >
      {/* Speech bubble */}
      {catState.data?.phrase && (
        <div className={`speech-bubble emotion-${catState.state}`}>
          {catState.data.phrase}
        </div>
      )}

      {/* Floating love hearts */}
      {hearts.map((h) => (
        <span 
          key={h.id} 
          className="heart-pop"
          style={{ left: `${h.x}px`, top: `${h.y}px` }}
        >
          ❤️
        </span>
      ))}

      {/* SVG Cream Cat */}
      <svg 
        width="220" 
        height="220" 
        viewBox="0 0 200 200" 
        className={`cat-svg state-${catState.state}`}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnterCat}
      >
        <g className="cat-render-group">
          {/* Back Leg (Behind) */}
          <path 
            className="leg back-leg-behind" 
            d="M 68,122 L 68,136 C 68,139 74,139 74,136 L 74,122" 
            fill="#e2e0c0" 
            stroke="#3d3534" 
            strokeWidth="3.5" 
            strokeLinecap="round"
          />
          {/* Front Leg (Behind) */}
          <path 
            className="leg front-leg-behind" 
            d="M 106,122 L 106,136 C 106,139 112,139 112,136 L 112,122" 
            fill="#e2e0c0" 
            stroke="#3d3534" 
            strokeWidth="3.5" 
            strokeLinecap="round"
          />

          {/* Waving Tail */}
          <g className="tail-wrapper">
            <path 
              className="tail-path" 
              d="M 52,102 C 34,94 18,74 24,54 C 27,47 34,47 32,58 C 29,74 42,88 52,94" 
              fill="#f5f4dc" 
              stroke="#3d3534" 
              strokeWidth="3.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </g>

          {/* Cat Body */}
          <path 
            className="cat-body" 
            d="M 50,102 C 50,82 72,75 96,75 L 118,82 L 122,102 C 122,117 116,124 106,124 C 96,124 80,124 66,124 C 53,124 50,117 50,102 Z" 
            fill="#f5f4dc" 
            stroke="#3d3534" 
            strokeWidth="3.5" 
            strokeLinejoin="round" 
            strokeLinecap="round"
          />

          {/* Front Leg (Main) */}
          <path 
            className="leg front-leg-main" 
            d="M 98,122 L 98,138 C 98,141 104,141 104,138 L 104,122" 
            fill="#f5f4dc" 
            stroke="#3d3534" 
            strokeWidth="3.5" 
            strokeLinecap="round"
          />
          {/* Back Leg (Main) */}
          <path 
            className="leg back-leg-main" 
            d="M 60,122 L 60,138 C 60,141 66,141 66,138 L 66,122" 
            fill="#f5f4dc" 
            stroke="#3d3534" 
            strokeWidth="3.5" 
            strokeLinecap="round"
          />

          {/* Swatting Paw (Only active during swat) */}
          <path 
            className="swatting-paw" 
            d="M 116,105 C 128,105 146,100 152,105 C 158,110 148,116 136,116" 
            fill="#f5f4dc" 
            stroke="#3d3534" 
            strokeWidth="3.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />

          {/* Cat Head */}
          <g className="cat-head-group">
            {/* Left Ear */}
            <path 
              className="cat-ear" 
              d="M 96,62 L 98,34 C 99,31 103,32 105,37 L 111,57 Z" 
              fill="#f5f4dc" 
              stroke="#3d3534" 
              strokeWidth="3.5" 
              strokeLinejoin="round" 
              strokeLinecap="round"
            />
            <path 
              className="cat-ear-inner" 
              d="M 99,57 L 101,39 L 106,53 Z" 
              fill="#f5b5b5"
            />

            {/* Right Ear */}
            <path 
              className="cat-ear" 
              d="M 120,57 L 126,37 C 128,32 132,31 133,34 L 135,62 Z" 
              fill="#f5f4dc" 
              stroke="#3d3534" 
              strokeWidth="3.5" 
              strokeLinejoin="round" 
              strokeLinecap="round"
            />
            <path 
              className="cat-ear-inner" 
              d="M 125,53 L 130,39 L 132,57 Z" 
              fill="#f5b5b5"
            />

            {/* Face Shape */}
            <circle 
              cx="120" 
              cy="76" 
              r="26" 
              fill="#f5f4dc" 
              stroke="#3d3534" 
              strokeWidth="3.5"
            />

            {/* Eyes */}
            <circle cx="128" cy="74" r="2.5" fill="#3d3534" className="cat-eye" />
            <circle cx="140" cy="74" r="2.5" fill="#3d3534" className="cat-eye" />

            {/* Cute :3 Mouth */}
            <path 
              d="M 132,80 C 133,81 134.2,81 134.7,80 C 135.2,81 136.4,81 137.4,80" 
              fill="none" 
              stroke="#3d3534" 
              strokeWidth="2" 
              strokeLinecap="round"
            />

            {/* Happy Blushing cheeks */}
            <ellipse cx="125" cy="78" rx="3" ry="1.5" fill="#f5b5b5" className="cat-blush" />
            <ellipse cx="143" cy="78" rx="3" ry="1.5" fill="#f5b5b5" className="cat-blush" />
          </g>
        </g>
      </svg>
    </div>
  );
};

export default Cat;
