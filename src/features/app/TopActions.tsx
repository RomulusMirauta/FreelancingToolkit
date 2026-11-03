import { useEffect, useState } from 'react';
import { useT } from '../../lib/i18n';
import type { Page } from '../../lib/ui/settingsKeys';
import type { Lang } from '../../lib/i18n';
import type { Theme } from '../../lib/ui/theme';
import { LangSlider, ThemeSlider } from './ThemeSlider';
import { useHoverMenu } from '../../lib/ui/useHoverMenu';
import { restoreOwnSettings, shareUrl, sharedLinkState } from '../../lib/ui/share';

/** Chrome and Edge's install event; not in TypeScript's DOM types yet. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Device = 'desktop' | 'android' | 'ios';

function detectDevice(): Device {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

const isInstalled = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

/**
 * "Settings & options" in the top-right corner: a menu (hover or click) with the theme and the language first (the
 * same sliding switches as before, with names), then "Copy link" and "Install".
 */
export function TopActions({ view, theme, setTheme, lang, setLang }: {
  view: Page;
  theme: Theme;
  setTheme: (t: Theme) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
}) {
  const t = useT().app;
  const [copied, setCopied] = useState<'no' | 'yes' | 'manual'>('no');
  const [link, setLink] = useState('');
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [installed, setInstalled] = useState(isInstalled);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // show our own button instead of Chrome's mini-bar
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const copy = async () => {
    const url = shareUrl(view);
    setLink(url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied('yes');
      setTimeout(() => setCopied('no'), 2500);
    } catch {
      setCopied('manual'); // clipboard blocked (embedded browsers): show the link to copy by hand
    }
  };

  const install = async () => {
    if (!prompt) {
      setShowSteps(!showSteps);
      return;
    }
    try {
      await prompt.prompt(); // Chrome and Edge's own install dialog
      await prompt.userChoice;
      setPrompt(null);
    } catch {
      setShowSteps(true); // the dialog was refused (it can be shown only once): explain the manual way
    }
  };

  const menu = useHoverMenu();

  return (
    <div className={`top-actions hover-menu${menu.open ? ' open' : ''}`} ref={menu.rootRef} {...menu.hoverProps}>
      <button type="button" className="top-btn menu-trigger" aria-haspopup="menu" aria-expanded={menu.open} onClick={menu.toggle}>
        <GearIcon />
        <span>{t.advanced}</span>
        <span className="chev" aria-hidden="true" />
      </button>
      <div className="menu-pop" role="menu" aria-label={t.advanced}>
        <div className="menu-theme" role="none">
          <span id="menu-theme-label">{t.theme}</span>
          <ThemeSlider theme={theme} setTheme={setTheme} />
        </div>
        <div className="menu-theme" role="none">
          <span>{t.language}</span>
          <LangSlider lang={lang} setLang={setLang} />
        </div>
        <div className="menu-sep" role="separator" />
        <button type="button" role="menuitem" onClick={copy} title={t.shareTitle}>
          <LinkIcon />
          <b>{copied === 'yes' ? t.copied : t.share}</b>
          <small>{t.shareHint}</small>
        </button>
        {!installed && (
          <button type="button" role="menuitem" onClick={() => { menu.setOpen(false); void install(); }} title={t.installTitle}>
            <InstallIcon />
            <b>{t.install}</b>
            <small>{t.installHint}</small>
          </button>
        )}
      </div>
      {copied === 'manual' && (
        <div className="top-panel" role="dialog" aria-label={t.copyManual}>
          <p>{t.copyManual}</p>
          <input readOnly value={link} onFocus={(e) => e.target.select()} autoFocus />
          <button type="button" className="link-btn" onClick={() => setCopied('no')}>{t.close}</button>
        </div>
      )}
      {showSteps && <InstallSteps onClose={() => setShowSteps(false)} />}
    </div>
  );
}

/** Plain steps for this device first, then the others. */
function InstallSteps({ onClose }: { onClose: () => void }) {
  const t = useT().app;
  const device = detectDevice();
  const order: Device[] = [device, ...(['desktop', 'android', 'ios'] as const).filter((d) => d !== device)];
  return (
    <div className="top-panel install-steps" role="dialog" aria-labelledby="install-title">
      <h2 id="install-title">{t.installHow}</h2>
      <p className="muted small">{t.installWhy}</p>
      {order.map((d, i) => (
        <details key={d} open={i === 0}>
          <summary>{t.devices[d]}{i === 0 && <span className="badge">{t.thisDevice}</span>}</summary>
          <ol>{t.steps[d].map((s) => <li key={s}>{s}</li>)}</ol>
        </details>
      ))}
      <button type="button" className="link-btn" onClick={onClose}>{t.close}</button>
    </div>
  );
}

/** Shown once, after opening a link with someone's settings. */
export function SharedBanner() {
  const t = useT().app;
  const [{ opened, hadOwn, same }] = useState(sharedLinkState);
  const [hidden, setHidden] = useState(false);
  if (!opened || hidden) return null;
  return (
    <div className="shared-banner" role="status">
      <span className="banner-icon" aria-hidden="true"><LinkIcon /></span>
      <span className="banner-text">{same ? t.sharedSame : hadOwn ? t.sharedOpenedOwn : t.sharedOpened}</span>
      {/* Real buttons: going back to your own settings is the main action, closing keeps the link's. */}
      <span className="banner-actions">
        {hadOwn && (
          <button type="button" className="banner-btn primary" onClick={restoreOwnSettings}>
            <span aria-hidden="true">↺</span> {t.restoreOwn}
          </button>
        )}
        {/* With own settings replaced, closing means keeping the link's: the button says so. */}
        <button type="button" className="banner-btn" onClick={() => setHidden(true)}>{hadOwn ? t.keepLink : t.close}</button>
      </span>
    </div>
  );
}

/** A gear, for "Settings & options"; it turns a little when the menu opens. */
function GearIcon() {
  return (
    <svg className="gear" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
    </svg>
  );
}

function InstallIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M7 10l5 5 5-5M4 19h16" />
    </svg>
  );
}
