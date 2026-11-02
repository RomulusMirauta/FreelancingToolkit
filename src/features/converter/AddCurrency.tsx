import { useT } from '../../lib/i18n';
import { CurrencyPicker } from './CurrencyPicker';

/** "+ Add currency": every BNR currency without a chip yet. */
export function AddCurrency({ exclude, onAdd }: { exclude: string[]; onAdd: (code: string) => void }) {
  const t = useT().addCurrency;
  return <CurrencyPicker trigger={t.button} triggerClass="add-btn" exclude={exclude} onPick={onAdd} />;
}
