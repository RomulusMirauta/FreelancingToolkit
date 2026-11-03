import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { startAnalytics } from './lib/analytics';
import { applySharedLink, finishSharedLink } from './lib/ui/share';
import { applyUrlState } from './urlState';
// Bundled (not from a CDN) so the app keeps working offline; only the bold Latin subset used by the regime pills.
import '@fontsource/space-grotesk/latin-700.css';
import './styles.css';

registerSW({ immediate: true });
// Before the first render, so every setting is read from the link or the address.
applySharedLink();
applyUrlState();
finishSharedLink();
startAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
