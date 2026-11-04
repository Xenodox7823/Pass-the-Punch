import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { triggerFullscreen } from './utils/fullscreen';

// Automatically request browser fullscreen on any tap or click
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    () => {
      triggerFullscreen();
    },
    { passive: true }
  );
}

createRoot(document.getElementById('root')!).render(<App />);
