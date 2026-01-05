import { createRoot } from 'react-dom/client'
import './index.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import App from './App.jsx'

// Prevent noisy console error when a media `play()` Promise is aborted by a subsequent `pause()`.
// This commonly occurs when UI interactions rapidly call play() then pause(); it's safe to
// ignore the specific AbortError since it doesn't affect app logic.
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = reason && reason.message ? reason.message : '';
  if (reason && (reason.name === 'AbortError' || message.includes('play() request was interrupted'))) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')).render(
  <App />
)
