// Web Audio playback for synthesized SFX + music (assets in public/audio).
// UI-only module: the engine stays pure and merely emits events that
// soundBindings.ts translates into play() calls.

/** All short effect clips (file is `${name}.wav` under public/audio). */
export const SFX_NAMES = [
  'chop',
  'mine',
  'splash',
  'hit',
  'miss',
  'death',
  'levelup',
  'eat',
  'fire',
  'cook',
  'pickup',
  'drop',
  'bank',
  'click',
] as const

export type SfxName = (typeof SFX_NAMES)[number]

const MUSIC_NAME = 'music_main'

/** Minimum ms between two plays of the SAME sfx (anti machine-gun). */
export const SFX_DEBOUNCE_MS = 150

const STORAGE_SFX = 'rs.audio.sfx'
const STORAGE_MUSIC = 'rs.audio.music'

function loadFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) !== '0'
  } catch {
    return true
  }
}

function saveFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* private mode etc. — non-fatal */
  }
}

declare global {
  interface Window {
    // Older Safari (incl. iOS) only exposes the prefixed constructor.
    webkitAudioContext?: typeof AudioContext
  }
}

/** Resolve the AudioContext constructor with the legacy Safari fallback. */
function getAudioContextCtor(): typeof AudioContext | undefined {
  return typeof window === 'undefined'
    ? undefined
    : (window.AudioContext ?? window.webkitAudioContext)
}

/** User-gesture events that are allowed to unlock/resume audio on iOS. */
const UNLOCK_EVENTS = ['pointerdown', 'touchend', 'keydown', 'click'] as const

/**
 * Loads and plays the game's audio clips.
 *
 * Browser autoplay policy: an AudioContext starts suspended and may only be
 * resumed from inside a real user-gesture handler. iOS Safari is stricter —
 * it additionally requires a buffer to actually play during that gesture and
 * re-suspends the context whenever the page is backgrounded. So `init()`
 * eagerly fetches the encoded WAV bytes but defers creating/resuming the
 * AudioContext until the first gesture, plays a silent buffer to unlock iOS,
 * keeps retrying on later gestures until the context is truly `running`, and
 * re-resumes on `visibilitychange`. Music starts once the context is unlocked.
 */
export class AudioManager {
  private ctx: AudioContext | null = null
  private sfxGain: GainNode | null = null
  private musicGain: GainNode | null = null
  private encoded = new Map<string, ArrayBuffer>()
  private buffers = new Map<string, AudioBuffer>()
  private musicSource: AudioBufferSourceNode | null = null
  private lastPlayedAt = new Map<string, number>()
  private removeGestureListeners: (() => void) | null = null
  private removeVisibilityListener: (() => void) | null = null
  private decodeStarted = false
  private disposed = false

  private _sfxEnabled = loadFlag(STORAGE_SFX)
  private _musicEnabled = loadFlag(STORAGE_MUSIC)

  get sfxEnabled(): boolean {
    return this._sfxEnabled
  }

  get musicEnabled(): boolean {
    return this._musicEnabled
  }

  /**
   * Start fetching assets and arm the first-gesture unlock listener.
   * Safe to call again after dispose() (React StrictMode re-mounts).
   */
  init(): void {
    this.disposed = false
    void this.fetchAll()
    this.armGestureUnlock()
    this.armVisibilityResume()
  }

  /** Play a sound effect (no-op before unlock / while sfx muted). */
  play(name: SfxName, { volume = 1 }: { volume?: number } = {}): void {
    if (!this._sfxEnabled || !this.ctx || !this.sfxGain) return
    const buffer = this.buffers.get(name)
    if (!buffer) return
    const now = performance.now()
    const last = this.lastPlayedAt.get(name)
    if (last !== undefined && now - last < SFX_DEBOUNCE_MS) return
    this.lastPlayedAt.set(name, now)

    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    if (volume === 1) {
      source.connect(this.sfxGain)
    } else {
      const gain = this.ctx.createGain()
      gain.gain.value = volume
      source.connect(gain)
      gain.connect(this.sfxGain)
    }
    source.start()
  }

  setSfxEnabled(enabled: boolean): void {
    this._sfxEnabled = enabled
    saveFlag(STORAGE_SFX, enabled)
  }

  setMusicEnabled(enabled: boolean): void {
    this._musicEnabled = enabled
    saveFlag(STORAGE_MUSIC, enabled)
    if (enabled) this.startMusic()
    else this.stopMusic()
  }

  /** Begin the looping music track (no-op before unlock or while muted). */
  startMusic(): void {
    if (!this._musicEnabled || !this.ctx || !this.musicGain || this.musicSource) return
    const buffer = this.buffers.get(MUSIC_NAME)
    if (!buffer) return
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(this.musicGain)
    source.start()
    this.musicSource = source
  }

  stopMusic(): void {
    this.musicSource?.stop()
    this.musicSource?.disconnect()
    this.musicSource = null
  }

  dispose(): void {
    this.disposed = true
    this.removeGestureListeners?.()
    this.removeVisibilityListener?.()
    this.stopMusic()
    void this.ctx?.close()
    this.ctx = null
    this.sfxGain = null
    this.musicGain = null
    this.buffers.clear()
    this.decodeStarted = false
  }

  private async fetchAll(): Promise<void> {
    if (this.encoded.size > 0) return // already fetched (re-init)
    const base = import.meta.env.BASE_URL
    const names = [...SFX_NAMES, MUSIC_NAME]
    await Promise.all(
      names.map(async (name) => {
        try {
          const res = await fetch(`${base}audio/${name}.wav`)
          if (!res.ok) return
          this.encoded.set(name, await res.arrayBuffer())
        } catch {
          /* missing/failed asset — that sound simply never plays */
        }
      }),
    )
  }

  /** Listen for the first user gesture(s) that let us unlock/resume audio. */
  private armGestureUnlock(): void {
    if (this.removeGestureListeners) return
    const handler = (): void => {
      void this.unlock()
    }
    for (const type of UNLOCK_EVENTS) window.addEventListener(type, handler)
    this.removeGestureListeners = () => {
      for (const type of UNLOCK_EVENTS) window.removeEventListener(type, handler)
      this.removeGestureListeners = null
    }
  }

  /** iOS re-suspends the context when backgrounded — resume when visible again. */
  private armVisibilityResume(): void {
    if (this.removeVisibilityListener) return
    const handler = (): void => {
      if (document.visibilityState !== 'visible') return
      const ctx = this.ctx
      if (!ctx || ctx.state !== 'suspended') return
      void ctx.resume().then(() => {
        if (!this.disposed) this.startMusic()
      })
    }
    document.addEventListener('visibilitychange', handler)
    this.removeVisibilityListener = () => {
      document.removeEventListener('visibilitychange', handler)
      this.removeVisibilityListener = null
    }
  }

  /**
   * Resume (and, on iOS, truly unlock) the AudioContext. Runs inside a user
   * gesture; keeps the gesture listeners armed until the context reaches
   * `running`, since the first attempt can silently fail on iOS.
   */
  private async unlock(): Promise<void> {
    if (this.disposed) return
    const ctx = this.ensureContext()
    if (!ctx) return

    // iOS only unlocks output if a buffer actually plays during the gesture.
    this.playSilentBuffer(ctx)
    try {
      if (ctx.state === 'suspended') await ctx.resume()
    } catch {
      /* resume can reject outside a gesture — retry on the next one */
    }
    if (this.disposed) return

    // Only stop listening once the context is genuinely running.
    if (ctx.state === 'running') this.removeGestureListeners?.()
    this.startMusic()
  }

  /** Lazily create the AudioContext (with the Safari fallback) + gain nodes. */
  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx
    const AudioContextCtor = getAudioContextCtor()
    if (!AudioContextCtor) return null
    const ctx = new AudioContextCtor()
    this.ctx = ctx
    this.sfxGain = ctx.createGain()
    this.sfxGain.gain.value = 0.8
    this.sfxGain.connect(ctx.destination)
    this.musicGain = ctx.createGain()
    this.musicGain.gain.value = 0.45
    this.musicGain.connect(ctx.destination)
    void this.decodeAll(ctx)
    return ctx
  }

  /** Play a one-sample silent buffer to satisfy iOS' unlock requirement. */
  private playSilentBuffer(ctx: AudioContext): void {
    const source = ctx.createBufferSource()
    source.buffer = ctx.createBuffer(1, 1, 22050)
    source.connect(ctx.destination)
    source.start(0)
  }

  /** Decode the fetched WAV bytes once, then (re)start music if enabled. */
  private async decodeAll(ctx: AudioContext): Promise<void> {
    if (this.decodeStarted) return
    this.decodeStarted = true

    // Wait until fetches settle (fetchAll never rejects), then decode.
    for (let waited = 0; this.encoded.size === 0 && waited < 10_000; waited += 100) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    if (this.disposed) return
    await Promise.all(
      [...this.encoded.entries()].map(async ([name, bytes]) => {
        try {
          this.buffers.set(name, await ctx.decodeAudioData(bytes.slice(0)))
        } catch {
          /* undecodable asset — skip */
        }
      }),
    )
    if (!this.disposed) this.startMusic()
  }
}
