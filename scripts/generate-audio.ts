/**
 * scripts/generate-audio.ts
 *
 * Generates WAV audio files for words and example sentences from public/words.json
 * using Google Gemini TTS (@google/genai) with VRT Flemish voice settings.
 *
 * Default: Processes 1 word (1 word WAV + 1 sentence WAV).
 *
 * Usage:
 *   npx tsx scripts/generate-audio.ts             # Default: 1 word pair
 *   npx tsx scripts/generate-audio.ts --limit 5   # Process 5 words
 *   npx tsx scripts/generate-audio.ts --all       # Process all words
 *   npx tsx scripts/generate-audio.ts --force     # Overwrite existing WAV files
 */

import { GoogleGenAI } from '@google/genai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Resolve current directory in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const CONFIG = {
  // Default count of words to process (each word produces 1 word + 1 sentence wav)
  defaultLimit: 1,

  // Folders and files
  wordsFilePath: path.join(ROOT_DIR, 'public', 'words.json'),
  outputDir: path.join(ROOT_DIR, 'wav'),

  // Gemini TTS model & Voice settings
  model: process.env.GEMINI_MODEL || 'gemini-3.8-flash-tts',
  voiceName: 'Iapetus', // Options: Iapetus, Charon, Erinome, Sulafat
  voiceStyle:
    'VRT nieuwsstijl, algemeen beschaafd vlaams met een subtiele gentse tongval, rustig en professioneel. Gebruik onder geen beding Engelse of Nederlandse uitspraakregels.',

  // Delay between API calls in ms to respect rate limits
  requestDelayMs: 60000,
}

// ---------------------------------------------------------------------------
// Environment Variable Loader (.env fallback if not set)
// ---------------------------------------------------------------------------
function loadEnvFallback() {
  if (process.env.GEMINI_API_KEY) return

  const envPaths = [
    path.join(ROOT_DIR, '.env'),
    path.join(ROOT_DIR, '.env.local'),
  ]

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const [key, ...values] = trimmed.split('=')
        const val = values.join('=').replace(/^['"]|['"]$/g, '')
        if (key && !process.env[key]) {
          process.env[key] = val
        }
      }
    }
  }
}

loadEnvFallback()

const API_KEY = process.env.GEMINI_API_KEY
if (!API_KEY) {
  console.error('\x1b[31mError: GEMINI_API_KEY is not defined.\x1b[0m')
  console.error(
    'Please set it in your .env file or run with: $env:GEMINI_API_KEY="your-key"'
  )
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Filename Slug Generator (Matching src/utils/audio.ts)
// ---------------------------------------------------------------------------

/**
 * Generates base filename without extension matching getAudioUrl in src/utils/audio.ts
 */
function getFileBaseName(
  text: string,
  type: 'word' | 'sentence' = 'word'
): string {
  // Strip parentheses/annotations like "De berg (-en)" -> "De berg"
  const cleaned = text.replace(/\s*\([^)]*\)/g, '').trim()
  const slug = cleaned
    .toLowerCase()
    .replace(/[/*_.,!?'"“”«»;:()]/g, ' ')
    .trim()
    .replace(/\s+/g, '_')

  return type === 'sentence' ? `sentence_${slug}` : slug
}

// ---------------------------------------------------------------------------
// WAV Header Generator Helpers
// ---------------------------------------------------------------------------
interface WavConversionOptions {
  numChannels: number
  sampleRate: number
  bitsPerSample: number
}

function parseMimeType(mimeType: string): WavConversionOptions {
  const [fileType, ...params] = mimeType.split(';').map((s) => s.trim())
  const [, format] = (fileType || '').split('/')

  const options: WavConversionOptions = {
    numChannels: 1,
    sampleRate: 24000,
    bitsPerSample: 16,
  }

  if (format && format.startsWith('L')) {
    const bits = parseInt(format.slice(1), 10)
    if (!isNaN(bits)) {
      options.bitsPerSample = bits
    }
  }

  for (const param of params) {
    const [key, value] = param.split('=').map((s) => s.trim())
    if (key === 'rate') {
      const parsedRate = parseInt(value, 10)
      if (!isNaN(parsedRate)) {
        options.sampleRate = parsedRate
      }
    }
  }

  return options
}

function createWavHeader(dataLength: number, options: WavConversionOptions) {
  const { numChannels, sampleRate, bitsPerSample } = options

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
  const blockAlign = (numChannels * bitsPerSample) / 8
  const buffer = Buffer.alloc(44)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataLength, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20) // PCM = 1
  buffer.writeUInt16LE(numChannels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(bitsPerSample, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataLength, 40)

  return buffer
}

function prepareWavBuffer(rawBase64: string, mimeType: string): Buffer {
  const pcmBuffer = Buffer.from(rawBase64, 'base64')

  // If the audio payload is already a complete RIFF WAV, return it as-is
  if (pcmBuffer.subarray(0, 4).toString('ascii') === 'RIFF') {
    return pcmBuffer
  }

  const options = parseMimeType(mimeType)
  const header = createWavHeader(pcmBuffer.length, options)
  return Buffer.concat([header, pcmBuffer])
}

// ---------------------------------------------------------------------------
// Gemini TTS Client
// ---------------------------------------------------------------------------
const ai = new GoogleGenAI({
  apiKey: API_KEY,
})

async function synthesizeTextToWav(
  cleanText: string,
  outputPath: string
): Promise<void> {
  const config = {
    temperature: 1,
    responseModalities: ['audio'],
    speechConfig: {
      languageCode: 'nl-BE',
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: CONFIG.voiceName,
        },
      },
    },
    speechMetadata: {
      style: CONFIG.voiceStyle,
    },
  }

  // Single-file generation (avoids split chunk files)
  const response = await ai.models.generateContent({
    model: CONFIG.model,
    // Cast config to any to safely allow speechMetadata
    config: config as any,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `## Transcript:\n${cleanText}`,
          },
        ],
      },
    ],
  })

  const part = response.candidates?.[0]?.content?.parts?.find(
    (p: any) => p.inlineData
  )
  if (!part?.inlineData?.data) {
    throw new Error(`No audio data received for text: "${cleanText}"`)
  }

  const mimeType = part.inlineData.mimeType || 'audio/L16;rate=24000'
  const wavBuffer = prepareWavBuffer(part.inlineData.data, mimeType)

  fs.writeFileSync(outputPath, wavBuffer)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2)
  let limit = CONFIG.defaultLimit
  let force = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--all') {
      limit = Infinity
    } else if (arg === '--force' || arg === '-f') {
      force = true
    } else if (arg === '--limit' || arg === '-n') {
      const parsed = parseInt(args[i + 1], 10)
      if (!isNaN(parsed) && parsed > 0) {
        limit = parsed
        i++
      }
    }
  }

  return { limit, force }
}

// ---------------------------------------------------------------------------
// Main Generation Routine
// ---------------------------------------------------------------------------
interface WordItem {
  word: string
  en: string
  ex: string
}

async function main() {
  const { limit, force } = parseArgs()

  if (!fs.existsSync(CONFIG.wordsFilePath)) {
    console.error(`Cannot find words file at: ${CONFIG.wordsFilePath}`)
    process.exit(1)
  }

  // Ensure wav output folder exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true })
    console.log(`Created directory: ${CONFIG.outputDir}`)
  }

  const rawWords: WordItem[] = JSON.parse(
    fs.readFileSync(CONFIG.wordsFilePath, 'utf-8')
  )

  const itemsToProcess = rawWords.slice(
    0,
    limit === Infinity ? rawWords.length : limit
  )

  console.log(`\n🎧 Vlaams Audio Generator`)
  console.log(`Voice: ${CONFIG.voiceName} (${CONFIG.voiceStyle})`)
  console.log(`Target Output: ${CONFIG.outputDir}`)
  console.log(
    `Processing: ${itemsToProcess.length} word(s) (${itemsToProcess.length * 2} audio files total)\n`
  )

  let generatedCount = 0
  let skippedCount = 0

  for (let i = 0; i < itemsToProcess.length; i++) {
    const item = itemsToProcess[i]
    console.log(`[${i + 1}/${itemsToProcess.length}] "${item.word}"`)

    // 1. Process Word Audio
    // Strip annotations like "De berg (-en)" -> "De berg"
    const cleanWordSpeech = item.word.replace(/\s*\([^)]*\)/g, '').trim()
    const wordBaseName = getFileBaseName(item.word, 'word')
    const wordFilePath = path.join(CONFIG.outputDir, `${wordBaseName}.wav`)

    if (fs.existsSync(wordFilePath) && !force) {
      console.log(`  ✓ Word: ${wordBaseName}.wav (already exists, skipping)`)
      skippedCount++
    } else {
      process.stdout.write(`  ⏳ Synthesizing word: "${cleanWordSpeech}"... `)
      try {
        await synthesizeTextToWav(cleanWordSpeech, wordFilePath)
        console.log(`Saved -> ${wordBaseName}.wav`)
        generatedCount++
        await sleep(CONFIG.requestDelayMs)
      } catch (err: any) {
        console.log(`\x1b[31mFAILED\x1b[0m: ${err.message}`)
      }
    }

    // 2. Process Example Sentence Audio
    // Strip asterisks *aankondigen* -> aankondigen
    const cleanSentenceSpeech = item.ex.replace(/\*/g, '').trim()
    const sentenceBaseName = getFileBaseName(cleanSentenceSpeech, 'sentence')
    const sentenceFilePath = path.join(
      CONFIG.outputDir,
      `${sentenceBaseName}.wav`
    )

    if (fs.existsSync(sentenceFilePath) && !force) {
      console.log(
        `  ✓ Sentence: ${sentenceBaseName}.wav (already exists, skipping)`
      )
      skippedCount++
    } else {
      process.stdout.write(
        `  ⏳ Synthesizing sentence: "${cleanSentenceSpeech}"... `
      )
      try {
        await synthesizeTextToWav(cleanSentenceSpeech, sentenceFilePath)
        console.log(`Saved -> ${sentenceBaseName}.wav`)
        generatedCount++
        await sleep(CONFIG.requestDelayMs)
      } catch (err: any) {
        console.log(`\x1b[31mFAILED\x1b[0m: ${err.message}`)
      }
    }
  }

  console.log(`\n========================================`)
  console.log(`Summary:`)
  console.log(`  Generated: ${generatedCount} file(s)`)
  console.log(`  Skipped:   ${skippedCount} file(s)`)
  console.log(`========================================`)
  console.log(
    `\nConvert your .wav files to .opus in PowerShell with:\n` +
      `  cd wav\n` +
      `  Get-ChildItem -Filter "*.wav" | ForEach-Object {\n` +
      `      $baseName = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)\n` +
      `      ffmpeg -n -i $_.FullName -c:a libopus -b:a 64k "$baseName.opus"\n` +
      `  }\n`
  )
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
