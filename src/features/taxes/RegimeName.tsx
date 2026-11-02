/**
 * A regime label with its keywords (CIM, PFA, SRL) as static pills:
 * "PFA - Sistem real" → [PFA] Sistem real, "CIM + PFA" → [CIM] + [PFA].
 * Labels without a keyword (copyright) are shown as they are.
 */
export function RegimeName({ label }: { label: string }) {
  const parts = label.split(/\b(CIM|PFA|SRL)\b/);
  if (parts.length === 1) return <>{label}</>;
  return (
    <span className="regime-name">
      {parts.map((part, i) => {
        if (i % 2 === 1) return <span key={i} className="kw-pill">{part}</span>;
        // The " - " right after a keyword is replaced by the pill itself.
        const text = (i > 0 ? part.replace(/^\s*-\s*/, '') : part).trim();
        if (text === '+') return <span key={i} className="kw-plus" aria-hidden="true">+</span>;
        return text ? <span key={i} className="kw-rest">{text}</span> : null;
      })}
    </span>
  );
}
