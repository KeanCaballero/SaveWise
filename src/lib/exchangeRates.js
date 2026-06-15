// Exchange rate service — powered by api.frankfurter.app (free, ECB data, no key needed).
// All rates are stored relative to 1 USD so any pair can be converted in two steps.
// Results are cached in localStorage for 6 hours to avoid hammering the API.

const API_URL = 'https://api.frankfurter.app/latest?from=USD'
const CACHE_KEY = 'savewise_fx_rates_v1'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

/**
 * Returns a flat map of { PHP: 56.2, EUR: 0.92, ... } where every value
 * is "how many units of that currency equal 1 USD".
 * USD itself is injected as 1 so the same math works for every pair.
 */
export async function fetchRates() {
  // Return from cache if still fresh
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const { rates, timestamp } = JSON.parse(raw)
      if (Date.now() - timestamp < CACHE_TTL_MS) return rates
    }
  } catch (_) { /* ignore corrupt cache */ }

  const res = await fetch(API_URL)
  if (!res.ok) throw new Error(`Exchange rate fetch failed (${res.status})`)

  const data = await res.json()
  const rates = { ...data.rates, USD: 1 } // inject USD = 1

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rates, timestamp: Date.now() }))
  } catch (_) { /* ignore if storage is full */ }

  return rates
}

/**
 * Convert `amount` from one currency to another using a USD-based rate map.
 *
 * Examples (rates = { USD:1, PHP:56.2, EUR:0.92 }):
 *   convertAmount(100, 'USD', 'PHP', rates) → 5620
 *   convertAmount(100, 'PHP', 'USD', rates) → 1.78
 *   convertAmount(100, 'EUR', 'PHP', rates) → 6109
 *
 * Returns the original amount unchanged when:
 *   - currencies are the same
 *   - rates have not loaded yet (null)
 *   - the currency code is not in the rate map
 */
export function convertAmount(amount, fromCurrency, toCurrency, rates) {
  const n = Number(amount) || 0
  if (!rates || !fromCurrency || fromCurrency === toCurrency) return n

  const fromRate = rates[fromCurrency]
  const toRate   = rates[toCurrency]

  // Graceful fallback: if either currency is unknown, return as-is
  if (!fromRate || !toRate) return n

  // Convert: original → USD → target
  return (n / fromRate) * toRate
}