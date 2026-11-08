import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { applySharedLink, finishSharedLink } from './lib/ui/share';
import { applyUrlState } from './urlState';
import { flushQuery } from './lib/ui/query';
import { droppedParams } from './lib/ui/urlQuery';
import { notifyLater } from './lib/ui/toast';
// Bundled (not from a CDN) so the app keeps working offline; only the bold Latin subset used by the regime pills.
import '@fontsource/space-grotesk/latin-700.css';
import './styles.css';
import './mobile.css';

// The address follows each change a moment later (query.ts): it catches up before the update reload, and when
// the page is left or hidden (a phone may close a hidden page without warning).
registerSW({ immediate: true, onNeedReload: () => { flushQuery(); location.reload(); } });
window.addEventListener('pagehide', () => flushQuery());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushQuery(); });
// Before the first render, so every setting is read from the link or the address.
applySharedLink();
applyUrlState();
finishSharedLink();
// At once: a link's mark leaves the address before anything can reload the page and open the link again.
flushQuery();
if (droppedParams().length) notifyLater('badLink');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
