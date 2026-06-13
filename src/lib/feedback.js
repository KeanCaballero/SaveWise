// Lightweight celebration feedback — synthesized in-browser (no audio files)
// plus optional haptics. Reserved for meaningful moments (achievement unlocks,
// milestones), never per-click. One device-level toggle controls all of it.

const SOUND_KEY = 'savewise_sound'

/** Default ON; '0' means the user turned it off on this device. */
export function isSoundEnabled() {
  return localStorage.getItem(SOUND_KEY) !== '0'
}

export function setSoundEnabled(on) {
  localStorage.setItem(SOUND_KEY, on ? '1' : '0')
}

let ctx = null
function audioContext() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    ctx = AC ? new AC() : null
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// Browsers keep audio suspended until the first user gesture — resume on it.
if (typeof window !== 'undefined') {
  const wake = () => audioContext()
  window.addEventListener('pointerdown', wake, { once: true })
  window.addEventListener('keydown', wake, { once: true })
}

function tone(freq, startAt, duration, { gain = 0.05, type = 'sine' } = {}) {
  const ac = audioContext()
  if (!ac) return
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  osc.connect(amp)
  amp.connect(ac.destination)
  const t0 = ac.currentTime + startAt
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.015)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.start(t0)
  osc.stop(t0 + duration + 0.03)
}

function vibrate(pattern) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern)
  } catch {
    /* not supported — ignore */
  }
}

/** Achievement unlocked — a bright ascending C–E–G–C arpeggio + haptic. */
export function celebrate() {
  if (!isSoundEnabled()) return
  tone(523.25, 0, 0.18)
  tone(659.25, 0.1, 0.18)
  tone(783.99, 0.2, 0.18)
  tone(1046.5, 0.32, 0.3, { gain: 0.045 })
  vibrate([14, 40, 18])
}

/** Smaller positive cue — goal/milestone reached. */
export function ding() {
  if (!isSoundEnabled()) return
  tone(659.25, 0, 0.13)
  tone(987.77, 0.09, 0.22, { gain: 0.045 })
  vibrate(18)
}
