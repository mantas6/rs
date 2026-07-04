#!/usr/bin/env python3
"""Generate all game audio (SFX + looping music) into public/audio/.

Pure-stdlib synthesis (math + wave + struct): 16-bit PCM mono 22050 Hz.
Deterministic: every noise source uses a fixed-seed random.Random, so
re-running the script reproduces identical files.

Usage: python3 scripts/generateAudio.py
"""

import math
import os
import random
import struct
import wave

SR = 22050
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "audio")

TWO_PI = 2.0 * math.pi


# ---------------------------------------------------------------- helpers

def zeros(seconds: float) -> list[float]:
    return [0.0] * int(SR * seconds)


def normalize(buf: list[float], peak: float = 0.9) -> list[float]:
    m = max((abs(s) for s in buf), default=0.0) or 1.0
    g = peak / m
    return [s * g for s in buf]


def fade_edges(buf: list[float], ms: float = 5.0) -> list[float]:
    """Linear fade at both ends to kill clicks (and loop-point pops)."""
    n = min(len(buf) // 2, int(SR * ms / 1000.0))
    for i in range(n):
        g = i / n
        buf[i] *= g
        buf[-1 - i] *= g
    return buf


def write(name: str, buf: list[float]) -> None:
    path = os.path.join(OUT_DIR, name)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = b"".join(
            struct.pack("<h", int(max(-1.0, min(1.0, s)) * 32767)) for s in buf
        )
        w.writeframes(frames)
    print(f"  {name:16s} {len(buf) / SR:5.2f}s  {os.path.getsize(path):>9,} bytes")


def sine(p: float) -> float:
    return math.sin(p)


def square(p: float) -> float:
    return 1.0 if math.sin(p) >= 0.0 else -1.0


def triangle(p: float) -> float:
    return 2.0 / math.pi * math.asin(math.sin(p))


def add_tone(
    buf: list[float],
    start: float,
    dur: float,
    freq: float,
    amp: float,
    osc=sine,
    attack: float = 0.01,
    release: float = 0.03,
    freq_end: float | None = None,
    vibrato: float = 0.0,
) -> None:
    """Mix a tone with a trapezoid (attack/sustain/release) envelope.

    freq_end enables a linear pitch sweep; vibrato is fractional depth at 5 Hz.
    """
    i0 = int(start * SR)
    n = int(dur * SR)
    f1 = freq if freq_end is None else freq_end
    phase = 0.0
    for i in range(n):
        t = i / n
        f = freq + (f1 - freq) * t
        if vibrato:
            f *= 1.0 + vibrato * math.sin(TWO_PI * 5.0 * i / SR)
        phase += TWO_PI * f / SR
        env = 1.0
        if attack > 0:
            env = min(env, (i / SR) / attack)
        if release > 0:
            env = min(env, ((n - i) / SR) / release)
        idx = i0 + i
        if 0 <= idx < len(buf):
            buf[idx] += amp * env * osc(phase)


def add_pluck(
    buf: list[float],
    start: float,
    dur: float,
    freq: float,
    amp: float,
    osc=sine,
    decay: float = 6.0,
    attack: float = 0.004,
    freq_end: float | None = None,
) -> None:
    """Mix a tone with a short attack then exponential decay envelope."""
    i0 = int(start * SR)
    n = int(dur * SR)
    f1 = freq if freq_end is None else freq_end
    phase = 0.0
    for i in range(n):
        t = i / SR
        f = freq + (f1 - freq) * (i / n)
        phase += TWO_PI * f / SR
        env = min(1.0, t / attack) if attack > 0 else 1.0
        env *= math.exp(-t * decay)
        idx = i0 + i
        if 0 <= idx < len(buf):
            buf[idx] += amp * env * osc(phase)


def noise_burst(
    dur: float,
    seed: int,
    decay: float = 20.0,
    attack: float = 0.002,
    lowpass: float = 1.0,
    highpass: bool = False,
) -> list[float]:
    """Exponentially decaying white noise, optionally one-pole filtered.

    lowpass in (0, 1]: 1 = unfiltered, smaller = darker.
    highpass=True subtracts the lowpassed signal (bright hiss).
    """
    rng = random.Random(seed)
    n = int(dur * SR)
    out = []
    lp = 0.0
    for i in range(n):
        t = i / SR
        x = rng.uniform(-1.0, 1.0)
        lp += lowpass * (x - lp)
        y = (x - lp) if highpass else lp
        env = min(1.0, t / attack) if attack > 0 else 1.0
        env *= math.exp(-t * decay)
        out.append(y * env)
    return out


def mix_into(buf: list[float], src: list[float], start: float = 0.0, gain: float = 1.0) -> None:
    i0 = int(start * SR)
    for i, s in enumerate(src):
        idx = i0 + i
        if 0 <= idx < len(buf):
            buf[idx] += s * gain


def midi(m: float) -> float:
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


# -------------------------------------------------------------------- SFX

def gen_chop() -> list[float]:
    """Woody thunk: low square knock + dark noise burst."""
    buf = zeros(0.20)
    add_pluck(buf, 0, 0.16, 110, 0.7, osc=square, decay=28.0, freq_end=70)
    mix_into(buf, noise_burst(0.12, seed=11, decay=45.0, lowpass=0.25), gain=0.8)
    return fade_edges(normalize(buf, 0.9))


def gen_mine() -> list[float]:
    """Rock tink: inharmonic metallic ping + bright transient."""
    buf = zeros(0.30)
    for f, a, d in ((1870, 0.5, 22.0), (2740, 0.35, 26.0), (3390, 0.25, 30.0)):
        add_pluck(buf, 0, 0.28, f, a, decay=d, attack=0.001)
    mix_into(buf, noise_burst(0.05, seed=22, decay=90.0, highpass=True, lowpass=0.5), gain=0.5)
    return fade_edges(normalize(buf, 0.85))


def gen_splash() -> list[float]:
    """Fishing splash: lowpassed noise that swells then falls."""
    rng = random.Random(33)
    n = int(0.45 * SR)
    buf = []
    lp = 0.0
    for i in range(n):
        t = i / n
        x = rng.uniform(-1.0, 1.0)
        lp += 0.18 * (x - lp)
        env = math.sin(math.pi * min(1.0, t * 1.15)) ** 1.5  # swell up, ease out
        buf.append(lp * env)
    add_pluck(buf, 0.02, 0.15, 320, 0.15, decay=25.0, freq_end=180)
    return fade_edges(normalize(buf, 0.85))


def gen_hit() -> list[float]:
    """Combat damage: punchy dark thud."""
    buf = zeros(0.16)
    add_pluck(buf, 0, 0.14, 130, 0.8, decay=32.0, freq_end=60)
    mix_into(buf, noise_burst(0.10, seed=44, decay=55.0, lowpass=0.3), gain=0.7)
    return fade_edges(normalize(buf, 0.9))


def gen_miss() -> list[float]:
    """Soft whiff: quiet airy noise sweep."""
    buf = zeros(0.16)
    mix_into(buf, noise_burst(0.15, seed=55, decay=22.0, attack=0.03, lowpass=0.55, highpass=True), gain=1.0)
    return fade_edges(normalize(buf, 0.4))


def gen_death() -> list[float]:
    """Descending square sweep."""
    buf = zeros(0.75)
    add_tone(buf, 0, 0.7, 420, 0.4, osc=square, attack=0.01, release=0.25, freq_end=70)
    add_tone(buf, 0, 0.7, 211, 0.2, osc=triangle, attack=0.01, release=0.25, freq_end=35)
    return fade_edges(normalize(buf, 0.85))


def gen_levelup() -> list[float]:
    """Rising major arpeggio jingle: C E G C' + closing chord shimmer."""
    buf = zeros(1.25)
    notes = (60, 64, 67, 72)  # C4 E4 G4 C5
    for i, m in enumerate(notes):
        add_pluck(buf, i * 0.13, 0.5, midi(m), 0.4, osc=triangle, decay=5.0)
    for m in (72, 76, 79):  # closing C major chord
        add_tone(buf, 0.55, 0.65, midi(m), 0.18, osc=triangle, attack=0.02, release=0.35, vibrato=0.004)
    return fade_edges(normalize(buf, 0.85))


def gen_eat() -> list[float]:
    """Crunch: two dark noise bites."""
    buf = zeros(0.28)
    mix_into(buf, noise_burst(0.09, seed=66, decay=50.0, lowpass=0.4), start=0.0, gain=1.0)
    mix_into(buf, noise_burst(0.09, seed=67, decay=50.0, lowpass=0.35), start=0.13, gain=0.85)
    return fade_edges(normalize(buf, 0.8))


def gen_fire() -> list[float]:
    """Crackle: sparse pops over a soft noise bed."""
    rng = random.Random(77)
    buf = zeros(0.65)
    mix_into(buf, noise_burst(0.65, seed=78, decay=3.5, attack=0.05, lowpass=0.2), gain=0.5)
    for _ in range(10):
        at = rng.uniform(0.02, 0.55)
        mix_into(buf, noise_burst(0.03, seed=rng.randrange(1 << 30), decay=140.0, lowpass=0.6), start=at, gain=rng.uniform(0.3, 0.8))
    return fade_edges(normalize(buf, 0.8))


def gen_cook() -> list[float]:
    """Sizzle: bright fluttering hiss."""
    rng = random.Random(88)
    n = int(0.5 * SR)
    buf = []
    lp = 0.0
    flutter = 0.0
    for i in range(n):
        t = i / SR
        x = rng.uniform(-1.0, 1.0)
        lp += 0.5 * (x - lp)
        if i % 220 == 0:  # ~100 Hz amplitude flutter, randomly re-rolled
            flutter = rng.uniform(0.35, 1.0)
        env = math.exp(-t * 4.0) * min(1.0, t / 0.02)
        buf.append((x - lp) * flutter * env)
    return fade_edges(normalize(buf, 0.6))


def gen_pickup() -> list[float]:
    """Bright short blip with a small upward sweep."""
    buf = zeros(0.14)
    add_pluck(buf, 0, 0.12, 880, 0.5, decay=18.0, freq_end=1320)
    return fade_edges(normalize(buf, 0.75))


def gen_drop() -> list[float]:
    """Dull downward blip."""
    buf = zeros(0.14)
    add_pluck(buf, 0, 0.12, 300, 0.5, osc=triangle, decay=22.0, freq_end=190)
    return fade_edges(normalize(buf, 0.7))


def gen_bank() -> list[float]:
    """Soft chest click: tick + low thump."""
    buf = zeros(0.22)
    mix_into(buf, noise_burst(0.03, seed=99, decay=120.0, lowpass=0.7), gain=0.6)
    add_pluck(buf, 0.03, 0.16, 160, 0.5, decay=25.0, freq_end=110)
    return fade_edges(normalize(buf, 0.7))


def gen_click() -> list[float]:
    """Tiny UI tick."""
    buf = zeros(0.06)
    mix_into(buf, noise_burst(0.02, seed=111, decay=160.0, lowpass=0.8), gain=0.5)
    add_pluck(buf, 0, 0.05, 1500, 0.3, decay=70.0)
    return fade_edges(normalize(buf, 0.5), ms=2.0)


def gen_smith() -> list[float]:
    """Furnace/anvil clang: bright inharmonic metal ring + hot hiss bed."""
    buf = zeros(0.32)
    for f, a, d in ((1120, 0.5, 16.0), (1680, 0.32, 20.0), (2510, 0.22, 24.0)):
        add_pluck(buf, 0, 0.3, f, a, decay=d, attack=0.001)
    mix_into(buf, noise_burst(0.04, seed=122, decay=80.0, highpass=True, lowpass=0.5), gain=0.45)
    mix_into(buf, noise_burst(0.28, seed=123, decay=6.0, attack=0.02, lowpass=0.15), gain=0.25)
    return fade_edges(normalize(buf, 0.85))


def gen_equip() -> list[float]:
    """Gearing up: short cloth/leather rustle with a soft metallic tap."""
    buf = zeros(0.18)
    mix_into(buf, noise_burst(0.12, seed=133, decay=28.0, attack=0.006, lowpass=0.35, highpass=True), gain=0.7)
    add_pluck(buf, 0.02, 0.12, 620, 0.35, osc=triangle, decay=24.0, freq_end=520)
    return fade_edges(normalize(buf, 0.6))


# ------------------------------------------------------------------ music

# 8 bars x 3 s = 24 s loop, I-vi-IV-V twice in C major.
BAR = 3.0
BEAT = BAR / 4.0  # 0.75 s

# (bass midi, pad chord midis) per bar
PROGRESSION = [
    (36, (60, 64, 67)),  # C
    (33, (57, 60, 64)),  # Am
    (41, (53, 57, 60)),  # F
    (43, (55, 59, 62)),  # G
] * 2

# (start beat, duration beats, midi) — C major pentatonic melody, phrase
# ends on D5 over G so it resolves into the E5 at the loop start.
MELODY = [
    (0, 2, 76), (2, 1, 79), (3, 1, 81),
    (4, 2, 84), (6, 1, 81), (7, 1, 79),
    (8, 1.5, 81), (9.5, 0.5, 79), (10, 2, 76),
    (12, 2, 74), (14, 1, 76), (15, 1, 79),
    (16, 2, 79), (18, 1, 76), (19, 1, 74),
    (20, 2, 72), (22, 1, 74), (23, 1, 76),
    (24, 2, 81), (26, 1, 79), (27, 1, 76),
    (28, 3, 74),
]


def gen_music() -> list[float]:
    buf = zeros(BAR * len(PROGRESSION))
    for bar, (bass, chord) in enumerate(PROGRESSION):
        at = bar * BAR
        add_pluck(buf, at, 2.6, midi(bass), 0.16, decay=1.4, attack=0.01)
        for m in chord:
            add_tone(buf, at + 0.02, BAR - 0.06, midi(m), 0.055, osc=triangle, attack=0.6, release=0.8)
    for start, dur, m in MELODY:
        at = start * BEAT
        d = dur * BEAT - 0.05
        add_tone(buf, at, d, midi(m), 0.14, attack=0.05, release=0.12, vibrato=0.004)
        add_tone(buf, at, d, midi(m + 7), 0.045, attack=0.08, release=0.15, vibrato=0.004)
    return fade_edges(normalize(buf, 0.75), ms=10.0)


# ------------------------------------------------------------------- main

GENERATORS = {
    "chop.wav": gen_chop,
    "mine.wav": gen_mine,
    "splash.wav": gen_splash,
    "hit.wav": gen_hit,
    "miss.wav": gen_miss,
    "death.wav": gen_death,
    "levelup.wav": gen_levelup,
    "eat.wav": gen_eat,
    "fire.wav": gen_fire,
    "cook.wav": gen_cook,
    "pickup.wav": gen_pickup,
    "drop.wav": gen_drop,
    "bank.wav": gen_bank,
    "click.wav": gen_click,
    "smith.wav": gen_smith,
    "equip.wav": gen_equip,
    "music_main.wav": gen_music,
}


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"Writing {len(GENERATORS)} files to {os.path.relpath(OUT_DIR)}:")
    for name, gen in GENERATORS.items():
        write(name, gen())


if __name__ == "__main__":
    main()
