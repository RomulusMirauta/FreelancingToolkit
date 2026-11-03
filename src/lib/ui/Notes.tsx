/**
 * The small print at the end of a card: one idea per row, each with a short bold lead
 * ("Default", "Days off"), in a quiet box apart from the controls above it.
 */
export function Notes({ items }: { items: readonly { lead: string; text: string }[] }) {
  return (
    <dl className="notes">
      {items.map((n) => (
        <div key={n.lead}>
          <dt>{n.lead}</dt>
          <dd>{n.text}</dd>
        </div>
      ))}
    </dl>
  );
}
