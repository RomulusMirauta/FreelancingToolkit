import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { applySharedLink, finishSharedLink } from './lib/ui/share';
import { applyUrlState } from './urlState';
import { flushQuery } from './lib/ui/query';
import { droppedParams } from './lib/ui/urlQuery';
import { notifyLater } from './lib/ui/toast';
import { reloadForUpdate, reloadOnTakeover } from './lib/ui/updateReload';
import { dropSecondCopy } from './lib/ui/secondCopy';
// Bundled (not from a CDN) so the app keeps working offline; only the bold Latin subset used by the regime pills.
import '@fontsource/space-grotesk/latin-700.css';
import './styles.css';
import './mobile.css';

// The update reload waits while the page is in use, and opens on the saved settings (updateReload.ts). The address
// follows a burst of changes a moment later (query.ts): it catches up before a reload, and when the page is left or
// hidden (a phone may close a hidden page without warning).
reloadOnTakeover();
registerSW({ immediate: true, onNeedReload: reloadForUpdate });
window.addEventListener('pagehide', () => flushQuery());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushQuery(); });
// One copy of the app: a service worker registered at …github.io//FreelancingToolkit/ before index.html put that
// address back to the app's own goes (secondCopy.ts).
if ('serviceWorker' in navigator) dropSecondCopy().catch(() => {});
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
