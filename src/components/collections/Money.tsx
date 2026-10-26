import { ar, formatAmount } from '../../i18n/collections'

/**
 * An amount of money: the number always reads left to right ("1,234.50")
 * with the currency after it, even inside right-to-left text.
 */
export function Money({ value }: { value: string }) {
  return (
    <span className="money">
      <bdi dir="ltr">{formatAmount(value)}</bdi> {ar.currency}
    </span>
  )
}
