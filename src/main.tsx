import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Register PWA service worker for desktop offline capability and fast loading
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('[RiskLab Desktop] New version available.');
      },
      onOfflineReady() {
        console.log('[RiskLab Desktop] App cached for offline desktop use.');
      },
    });
  } catch (e) {
    // Service worker registration safely deferred in sandboxed iframe environment
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

