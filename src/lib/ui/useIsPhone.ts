import { useEffect, useState } from 'react';

/** Phones: the same width as src/mobile.css. */
export const PHONE_QUERY = '(max-width: 600px)';

const phoneQuery = () => (typeof matchMedia === 'function' ? matchMedia(PHONE_QUERY) : null);

/** True on a phone-width screen; follows rotation and window resizing. */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => phoneQuery()?.matches ?? false);
  useEffect(() => {
    const q = phoneQuery();
    if (!q) return;
    const onChange = () => setPhone(q.matches);
    q.addEventListener('change', onChange);
    return () => q.removeEventListener('change', onChange);
  }, []);
  return phone;
}
