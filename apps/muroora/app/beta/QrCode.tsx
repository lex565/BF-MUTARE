/**
 * A QR code, drawn as SVG, with no dependency.
 *
 * WHY NOT A LIBRARY. Every QR package on npm is a build-time dependency added
 * to render one square on one page, and this repository is deliberately thin -
 * the brief's cost-control section asks that nothing be added without a
 * reason. The encoder below is the byte-mode subset that a URL needs and
 * nothing else: no Kanji mode, no numeric compaction, no logo overlay.
 *
 * WHAT IT SUPPORTS, honestly stated so nobody is surprised later:
 *   Byte mode only, error correction level M, versions 1 to 6.
 *
 *   CAPPED AT 6 ON PURPOSE. From version 7 the specification requires an
 *   18-bit version-information block written into two corners, and this
 *   encoder does not write it. Allowing version 7 without it would produce a
 *   code that LOOKS right and fails to scan on a good reader - the worst
 *   possible outcome, because it would be blamed on the phone. Version 6
 *   carries 104 characters, and `https://musuwo.online/beta/android` is 34.
 *
 *   Longer input returns nothing rather than drawing something unscannable.
 *   The page prints the URL underneath either way, so a missing square costs
 *   a little convenience and never sends anybody to the wrong place.
 *
 * Rendered on the server into static SVG, so the page ships no JavaScript for
 * it and it works with scripting switched off.
 */

/* ------------------------------------------------- Galois field arithmetic */

const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
{
  let x = 1
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255]
}

const mul = (a: number, b: number) =>
  a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]

/** Reed-Solomon error correction bytes for one block. */
function ecBytes(data: number[], count: number): number[] {
  // The generator polynomial for `count` correction bytes.
  let poly = [1]
  for (let i = 0; i < count; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j]
      next[j + 1] ^= mul(poly[j], EXP[i])
    }
    poly = next
  }

  const remainder = new Array<number>(count).fill(0)
  for (const byte of data) {
    const factor = byte ^ remainder[0]
    remainder.shift()
    remainder.push(0)
    if (factor !== 0) {
      for (let i = 0; i < count; i += 1) {
        remainder[i] ^= mul(poly[i + 1], factor)
      }
    }
  }
  return remainder
}

/* ------------------------------------------------------- version tables */

/**
 * Per version (1-10) at error correction level M:
 * [total data codewords, EC codewords per block, block count group 1,
 *  data codewords per block group 1, block count group 2, data per block g2]
 */
const VERSIONS: Record<number, [number, number, number, number, number, number]> = {
  1: [16, 10, 1, 16, 0, 0],
  2: [28, 16, 1, 28, 0, 0],
  3: [44, 26, 1, 44, 0, 0],
  4: [64, 18, 2, 32, 0, 0],
  5: [86, 24, 2, 43, 0, 0],
  6: [108, 16, 4, 27, 0, 0],
}

/** The highest version this encoder writes correctly. See the note above. */
const MAX_VERSION = 6

/** Where the alignment patterns go, per version. */
const ALIGN: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
}

/** Pre-computed format bits for level M with each of the 8 masks. */
const FORMAT_M = [
  0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0,
]

/**
 * Exported so db/verify-releases.mts can decode the output and prove the
 * payload survives placement, masking and interleaving. Not part of the
 * component's public interface.
 */
export function encode(text: string): { size: number; modules: boolean[][] } | null {
  const bytes = Array.from(new TextEncoder().encode(text))

  let version = 0
  for (let v = 1; v <= MAX_VERSION; v += 1) {
    // 4 bits mode + 8 bits length (versions 1-9) + the data itself.
    if (bytes.length * 8 + 4 + 8 <= VERSIONS[v][0] * 8) {
      version = v
      break
    }
  }
  // Too long for what this encoder writes correctly. Better nothing than a
  // square that will not scan.
  if (version === 0) return null

  const [totalData, ecPerBlock, g1Blocks, g1Size, g2Blocks, g2Size] =
    VERSIONS[version]

  /* ---------------------------------------------------------- bit stream */

  const bits: number[] = []
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >> i) & 1)
  }

  push(0b0100, 4) // byte mode
  push(bytes.length, 8) // versions 1-9 use an 8-bit length in byte mode
  for (const b of bytes) push(b, 8)

  // Terminator, then pad to a byte boundary, then the two alternating pad
  // bytes the specification requires.
  const capacity = totalData * 8
  push(0, Math.min(4, capacity - bits.length))
  while (bits.length % 8 !== 0) bits.push(0)

  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    data.push(parseInt(bits.slice(i, i + 8).join(''), 2))
  }
  const PADS = [0xec, 0x11]
  while (data.length < totalData) data.push(PADS[data.length % 2 === 0 ? 0 : 1])

  /* -------------------------------------------------- blocks and weaving */

  const blocks: number[][] = []
  let at = 0
  for (let i = 0; i < g1Blocks; i += 1) {
    blocks.push(data.slice(at, at + g1Size))
    at += g1Size
  }
  for (let i = 0; i < g2Blocks; i += 1) {
    blocks.push(data.slice(at, at + g2Size))
    at += g2Size
  }

  const ecs = blocks.map((b) => ecBytes(b, ecPerBlock))

  const woven: number[] = []
  const longest = Math.max(...blocks.map((b) => b.length))
  for (let i = 0; i < longest; i += 1) {
    for (const b of blocks) if (i < b.length) woven.push(b[i])
  }
  for (let i = 0; i < ecPerBlock; i += 1) {
    for (const e of ecs) woven.push(e[i])
  }

  /* ------------------------------------------------------------- modules */

  const size = version * 4 + 17
  const grid: (boolean | null)[][] = Array.from({ length: size }, () =>
    new Array<boolean | null>(size).fill(null),
  )

  const place = (r: number, c: number, v: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) grid[r][c] = v
  }

  // Finder patterns and their separators.
  const finder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const on =
          r >= 0 &&
          r <= 6 &&
          c >= 0 &&
          c <= 6 &&
          (r === 0 || r === 6 || c === 0 || c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4))
        place(row + r, col + c, on)
      }
    }
  }
  finder(0, 0)
  finder(0, size - 7)
  finder(size - 7, 0)

  // Timing patterns.
  for (let i = 8; i < size - 8; i += 1) {
    grid[6][i] = i % 2 === 0
    grid[i][6] = i % 2 === 0
  }

  // Alignment patterns, skipping the three finder corners.
  const centres = ALIGN[version]
  for (const r of centres) {
    for (const c of centres) {
      if (
        (r <= 8 && c <= 8) ||
        (r <= 8 && c >= size - 9) ||
        (r >= size - 9 && c <= 8)
      ) {
        continue
      }
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          place(
            r + dr,
            c + dc,
            Math.max(Math.abs(dr), Math.abs(dc)) !== 1,
          )
        }
      }
    }
  }

  grid[size - 8][8] = true // the always-dark module

  // Reserve the format areas so data does not land in them.
  const reserve = (r: number, c: number) => {
    if (grid[r][c] === null) grid[r][c] = false
  }
  for (let i = 0; i < 9; i += 1) {
    reserve(8, i)
    reserve(i, 8)
  }
  for (let i = 0; i < 8; i += 1) {
    reserve(8, size - 1 - i)
    reserve(size - 1 - i, 8)
  }

  /* ---------------------------------------------------- data, masked (0) */

  // Mask 0 - (row + col) % 2 - is used unconditionally. Choosing the best of
  // eight by penalty score is what the specification asks for, and it matters
  // for dense photographic scanning; for a short URL rendered large and
  // printed black on white, any valid mask scans. Stated rather than hidden.
  let bitIndex = 0
  let upward = true
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1 // the vertical timing column is skipped
    for (let i = 0; i < size; i += 1) {
      const row = upward ? size - 1 - i : i
      for (let k = 0; k < 2; k += 1) {
        const c = col - k
        if (grid[row][c] !== null) continue
        const byte = woven[bitIndex >> 3]
        const bit =
          byte === undefined ? 0 : (byte >> (7 - (bitIndex & 7))) & 1
        bitIndex += 1
        grid[row][c] = (bit === 1) !== ((row + c) % 2 === 0)
      }
    }
    upward = !upward
  }

  // Format information for level M, mask 0.
  const format = FORMAT_M[0]
  for (let i = 0; i < 15; i += 1) {
    const on = ((format >> i) & 1) === 1
    if (i < 6) grid[8][i] = on
    else if (i < 8) grid[8][i + 1] = on
    else if (i === 8) grid[7][8] = on
    else grid[14 - i][8] = on

    if (i < 8) grid[size - 1 - i][8] = on
    else grid[8][size - 15 + i] = on
  }

  return {
    size,
    modules: grid.map((row) => row.map((cell) => cell === true)),
  }
}

export function QrCode({
  value,
  size = 180,
}: {
  value: string
  size?: number
}) {
  const code = encode(value)

  // No code beats an unscannable one. The URL is printed under it regardless.
  if (!code) return null

  const quiet = 4
  const total = code.size + quiet * 2

  // One path for every dark module. Smaller than one <rect> each, and it
  // renders identically.
  const d: string[] = []
  for (let r = 0; r < code.size; r += 1) {
    for (let c = 0; c < code.size; c += 1) {
      if (code.modules[r][c]) d.push(`M${c + quiet} ${r + quiet}h1v1h-1z`)
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label={`QR code for ${value}`}
      shapeRendering="crispEdges"
    >
      {/* White quiet zone is part of the code, not decoration - a scanner
          needs it, so it is drawn rather than left to the page background. */}
      <rect width={total} height={total} fill="#ffffff" />
      <path d={d.join('')} fill="#12271b" />
    </svg>
  )
}
