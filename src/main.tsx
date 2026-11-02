import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { applySharedLink } from './lib/ui/share';
import { DEFAULT_SOURCE } from './features/converter/Converter';
import { applySourceQuery } from './features/converter/sourceQuery';
// Bundled (not from a CDN) so the app keeps working offline; only the bold Latin subset used by the regime pills.
import '@fontsource/space-grotesk/latin-700.css';
import './styles.css';

registerSW({ immediate: true });
// Before the first render, so every setting is read from the link or the address.
applySharedLink();
applySourceQuery(DEFAULT_SOURCE);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
