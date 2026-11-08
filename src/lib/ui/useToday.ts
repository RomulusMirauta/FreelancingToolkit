import { useEffect, useState } from 'react';
import { msToRomanianMidnight, todayInRomania } from '../time/today';

/**
 * Today's date in Romania, kept current on a page left open: read again at midnight there, and whenever the page
 * comes back into view, since a hidden page's timers can sleep through midnight. A new day renders the caller again.
 */
export function useToday(): Date {
  const [day, setDay] = useState(() => todayInRomania().getTime());
  useEffect(() => {
    let timer = 0;
    const check = () => {
      setDay(todayInRomania().getTime());
      clearTimeout(timer);
      timer = window.setTimeout(check, msToRomanianMidnight());
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    // From now, not from the first render: a midnight in between is not missed.
    check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return new Date(day);
}
