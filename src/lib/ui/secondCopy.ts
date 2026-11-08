/**
 * One copy of the app. GitHub Pages serves it at …github.io//FreelancingToolkit/ too, and opened there it registered
 * a second service worker, with its own copy of the app: around a release one copy was behind the other, and its
 * "updated" message named the older version. index.html now puts such an address back to the app's own before the
 * app registers its service worker; this drops a second one registered before.
 */
export async function dropSecondCopy(): Promise<void> {
  const own = new URL('./', location.href).href;
  const all = await navigator.serviceWorker.getRegistrations();
  // Only the app's own scope with a slash doubled: the site's other apps share the origin.
  const second = all.filter((r) => {
    const one = new URL(r.scope);
    one.pathname = one.pathname.replace(/\/{2,}/g, '/');
    return r.scope !== own && one.href === own;
  });
  if (second.length === 0) return;
  const names = await caches.keys();
  for (const r of second) {
    await r.unregister();
    // Its copy of the app too: workbox names its caches after the scope.
    for (const name of names) if (name.endsWith(`-${r.scope}`)) await caches.delete(name);
  }
  // The app's own may be a release behind, when only the second one was opened since: it updates now (the page then
  // reloads onto it), not on its next start, which would announce the older version.
  await all.find((r) => r.scope === own)?.update();
}
