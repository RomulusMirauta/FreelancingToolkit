/**
 * Smallest annual amount whose take-home `f(amount)` reaches `target`.
 *
 * Take-home is not monotonic: contribution bands create cliffs where earning a little more
 * leaves less, and the best amount can sit in a narrow window just below a cliff. So the range
 * is scanned; every drop between two scan points is located and the peak just before it is
 * checked; the first crossing is then bisected. Returns null when nothing up to 1e12 lei works.
 */
export function solveForTakeHome(f: (annual: number) => number, target: number, steps = 600): number | null {
  if (target <= 0) return 0;
  let top = Math.max(target, 1);
  while (f(top) < target) {
    top *= 1.5;
    if (top > 1e12) return null;
  }
  const step = top / steps;
  let prevX = 0;
  let prevF = f(0);
  for (let i = 1; i <= steps; i++) {
    const x = step * i;
    const fx = f(x);
    if (fx >= target) return bisect(f, target, prevX, x);
    if (fx < prevF) {
      // A cliff lies in (prevX, x]: find the last point before the drop.
      let lo = prevX;
      let hi = x;
      for (let k = 0; k < 80 && hi - lo > 1e-7; k++) {
        const mid = (lo + hi) / 2;
        if (f(mid) >= prevF) lo = mid;
        else hi = mid;
      }
      if (f(lo) >= target) return bisect(f, target, prevX, lo);
    }
    prevX = x;
    prevF = fx;
  }
  return top;
}

/** f(lo) < target <= f(hi), with f nondecreasing in between. */
function bisect(f: (x: number) => number, target: number, lo: number, hi: number): number {
  for (let i = 0; i < 80 && hi - lo > 1e-7; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}
