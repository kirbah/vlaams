/**
 * scripts/generate-audio.ts
 *
 * Batch generates WAV audio files for missing words and sentences from public/words.json
 * using Google Gemini TTS (@google/genai) with VRT Flemish voice settings.
 *
 * Batches up to 20 items per API call to conserve RPD/RPM quotas, then slices
 * the returned audio on silence intervals and trims excess silence.
 *
 * Usage:
 *   npx tsx scripts/generate-audio-batch.ts        # Default: generate 20 new WAV files
 *   npx tsx scripts/generate-audio-batch.ts 10     # Generate 10 new WAV files
 *   npx tsx scripts/generate-audio-batch.ts 30     # Generate 30 new WAV files (3 batches of 10)
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
  // Default number of new audio files to generate if no CLI argument is given
  defaultTargetCount: 20,

  // Number of items sent per Gemini API call
  batchSize: 20,

  // Folders and files
  wordsFilePath: path.join(ROOT_DIR, 'public', 'words.json'),
  outputDir: path.join(ROOT_DIR, 'wav'),

  // Gemini TTS model & Voice settings (kept identical to your working settings)
  model: process.env.GEMINI_MODEL || 'gemini-3.8-flash-tts',
  voiceName: 'Iapetus',
  voiceStyle:
    'VRT nieuwsstijl, algemeen beschaafd vlaams met een subtiele gentse tongval, rustig en professioneel. Gebruik onder geen beding Engelse of Nederlandse uitspraakregels.',

  // Delay between API calls in ms when running multiple batches
  batchDelayMs: 10000,
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
// Filename Slug Generator (Matches src/utils/audio.ts)
// ---------------------------------------------------------------------------
function getFileBaseName(
  text: string,
  type: 'word' | 'sentence' = 'word'
): string {
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

function extractPcmData(rawBuffer: Buffer): { pcm: Buffer; isWav: boolean } {
  // If buffer already starts with RIFF header, isolate pure PCM payload
  if (rawBuffer.subarray(0, 4).toString('ascii') === 'RIFF') {
    const dataOffset = rawBuffer.indexOf('data')
    if (dataOffset !== -1 && dataOffset + 8 <= rawBuffer.length) {
      // 1. Read the exact length of the audio data (4 bytes, Little Endian)
      const dataSize = rawBuffer.readUInt32LE(dataOffset + 4)

      // 2. Slice ONLY the actual audio, ignoring any trailing metadata tags
      const endOffset = Math.min(dataOffset + 8 + dataSize, rawBuffer.length)
      const pcm = rawBuffer.subarray(dataOffset + 8, endOffset)

      return { pcm, isWav: true }
    }
    return { pcm: rawBuffer.subarray(44), isWav: true }
  }
  return { pcm: rawBuffer, isWav: false }
}

// ---------------------------------------------------------------------------
// Silence-based PCM Audio Slicing & Auto-Trimming
// ---------------------------------------------------------------------------
interface SilentInterval {
  startByte: number
  endByte: number
  durationSec: number
}

/**
 * Trims leading and trailing silent dead air from an extracted audio slice,
 * leaving a clean ~80ms natural padding.
 */
function trimSilence(
  pcm: Buffer,
  threshold = 300,
  paddingMs = 80,
  sampleRate = 24000
): Buffer {
  const bytesPerSample = 2
  const paddingBytes =
    Math.floor((paddingMs * sampleRate) / 1000) * bytesPerSample

  let firstSoundByte = 0
  for (let i = 0; i < pcm.length; i += bytesPerSample) {
    if (i + 1 >= pcm.length) break
    if (Math.abs(pcm.readInt16LE(i)) > threshold) {
      firstSoundByte = i
      break
    }
  }

  let lastSoundByte = pcm.length
  for (let i = pcm.length - bytesPerSample; i >= 0; i -= bytesPerSample) {
    if (Math.abs(pcm.readInt16LE(i)) > threshold) {
      lastSoundByte = i + bytesPerSample
      break
    }
  }

  if (firstSoundByte >= lastSoundByte) {
    return pcm // Entire chunk is silent or very quiet
  }

  const start = Math.max(0, firstSoundByte - paddingBytes)
  const alignedStart = start - (start % bytesPerSample)
  const end = Math.min(pcm.length, lastSoundByte + paddingBytes)
  const alignedEnd = end - (end % bytesPerSample)

  return pcm.subarray(alignedStart, alignedEnd)
}

/**
 * Identifies the breaks between items in a monolithic PCM buffer and slices it.
 */
function splitPcmBuffer(
  pcmBuffer: Buffer,
  expectedSlices: number,
  options: WavConversionOptions
): Buffer[] {
  if (expectedSlices <= 1) {
    return [trimSilence(pcmBuffer, 300, 80, options.sampleRate)]
  }

  const sampleRate = options.sampleRate
  const bytesPerSample = (options.bitsPerSample || 16) / 8
  const frameSamples = Math.floor(sampleRate * 0.02) // 20ms frames
  const frameBytes = frameSamples * bytesPerSample
  const silenceThreshold = 600 // Amplitude threshold for silence

  // 1. Detect all continuous silent intervals
  const intervals: SilentInterval[] = []
  let inSilence = false
  let silenceStartByte = 0

  for (let i = 0; i < pcmBuffer.length; i += frameBytes) {
    const end = Math.min(i + frameBytes, pcmBuffer.length)
    let sumAbs = 0
    let sampleCount = 0

    for (let s = i; s < end - 1; s += bytesPerSample) {
      sumAbs += Math.abs(pcmBuffer.readInt16LE(s))
      sampleCount++
    }

    const avgAmp = sampleCount > 0 ? sumAbs / sampleCount : 0
    const isFrameSilent = avgAmp < silenceThreshold

    if (isFrameSilent) {
      if (!inSilence) {
        inSilence = true
        silenceStartByte = i
      }
    } else {
      if (inSilence) {
        const durationSec =
          (i - silenceStartByte) / (sampleRate * bytesPerSample)
        intervals.push({
          startByte: silenceStartByte,
          endByte: i,
          durationSec,
        })
        inSilence = false
      }
    }
  }

  if (inSilence) {
    const durationSec =
      (pcmBuffer.length - silenceStartByte) / (sampleRate * bytesPerSample)
    intervals.push({
      startByte: silenceStartByte,
      endByte: pcmBuffer.length,
      durationSec,
    })
  }

  // 2. Select the top (expectedSlices - 1) longest silences (corresponds to <break time="3.0s"/>)
  const neededSplits = expectedSlices - 1
  const sortedByDuration = [...intervals].sort(
    (a, b) => b.durationSec - a.durationSec
  )
  const chosenBreaks = sortedByDuration.slice(0, neededSplits)

  // Sort them chronologically
  chosenBreaks.sort((a, b) => a.startByte - b.startByte)

  // 3. Cut at the midpoint of each selected silent interval
  const cutPoints: number[] = chosenBreaks.map((interval) => {
    const mid = Math.floor((interval.startByte + interval.endByte) / 2)
    return mid - (mid % bytesPerSample)
  })

  // 4. Produce chunks
  const slices: Buffer[] = []
  let previousCut = 0

  for (const cut of cutPoints) {
    slices.push(pcmBuffer.subarray(previousCut, cut))
    previousCut = cut
  }
  slices.push(pcmBuffer.subarray(previousCut))

  // 5. Trim silence on all individual chunks
  return slices.map((chunk) =>
    trimSilence(chunk, silenceThreshold, 80, options.sampleRate)
  )
}

// ---------------------------------------------------------------------------
// Gemini TTS Client & Synthesis
// ---------------------------------------------------------------------------
const ai = new GoogleGenAI({
  apiKey: API_KEY,
})

interface AudioTask {
  type: 'word' | 'sentence'
  text: string
  fileName: string
  filePath: string
  sourceWord: string
}

async function synthesizeBatchToFiles(
  batch: AudioTask[],
  outputDir: string
): Promise<void> {
  const DELIMITER = '\n\n<break time="3.0s"/>\n\n'
  const transcript = batch.map((item) => item.text).join(DELIMITER)

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

  const response = await ai.models.generateContent({
    model: CONFIG.model,
    config: config as any,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `## Transcript:\n${transcript}`,
          },
        ],
      },
    ],
  })

  const part = response.candidates?.[0]?.content?.parts?.find(
    (p: any) => p.inlineData
  )

  if (!part?.inlineData?.data) {
    throw new Error('No audio data received from Gemini API response.')
  }

  const mimeType = part.inlineData.mimeType || 'audio/L16;rate=24000'
  const options = parseMimeType(mimeType)
  const rawBase64 = part.inlineData.data
  const rawBuffer = Buffer.from(rawBase64, 'base64')

  const { pcm } = extractPcmData(rawBuffer)

  // Split monolithic audio into individual pieces matching batch items
  const slicedPcmBuffers = splitPcmBuffer(pcm, batch.length, options)

  for (let i = 0; i < batch.length; i++) {
    const task = batch[i]
    const pcmSlice = slicedPcmBuffers[i] || Buffer.alloc(0)

    const header = createWavHeader(pcmSlice.length, options)
    const wavBuffer = Buffer.concat([header, pcmSlice])

    fs.writeFileSync(task.filePath, wavBuffer)

    const durationSec = (pcmSlice.length / (options.sampleRate * 2)).toFixed(1)

    console.log(
      `  ✓ Saved [${task.type}] "${task.fileName}" (${durationSec}s) <- "${task.text}"`
    )
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// CLI Argument Parser (Single parameter)
// ---------------------------------------------------------------------------
function parseSingleParam(): number {
  const args = process.argv.slice(2)
  for (const arg of args) {
    const cleaned = arg.replace(/^--count=|^--limit=|-n=/, '')
    const parsed = parseInt(cleaned, 10)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return CONFIG.defaultTargetCount
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
interface WordItem {
  word: string
  en: string
  ex: string
}

async function main() {
  const targetNewCount = parseSingleParam()

  if (!fs.existsSync(CONFIG.wordsFilePath)) {
    console.error(`Cannot find words file at: ${CONFIG.wordsFilePath}`)
    process.exit(1)
  }

  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true })
    console.log(`Created directory: ${CONFIG.outputDir}`)
  }

  const rawWords: WordItem[] = JSON.parse(
    fs.readFileSync(CONFIG.wordsFilePath, 'utf-8')
  )

  // 1. Scan public/words.json and check which WAV files actually exist
  const missingTasks: AudioTask[] = []

  for (const item of rawWords) {
    // Check Word
    if (item.word) {
      const cleanWordSpeech = item.word.replace(/\s*\([^)]*\)/g, '').trim()
      const wordBaseName = getFileBaseName(item.word, 'word')
      const wordFilePath = path.join(CONFIG.outputDir, `${wordBaseName}.wav`)

      // Check if file doesn't exist or is empty
      if (
        !fs.existsSync(wordFilePath) ||
        fs.statSync(wordFilePath).size < 100
      ) {
        missingTasks.push({
          type: 'word',
          text: cleanWordSpeech,
          fileName: `${wordBaseName}.wav`,
          filePath: wordFilePath,
          sourceWord: item.word,
        })
      }
    }

    // Check Example Sentence
    if (item.ex) {
      const cleanSentenceSpeech = item.ex.replace(/\*/g, '').trim()
      const sentenceBaseName = getFileBaseName(cleanSentenceSpeech, 'sentence')
      const sentenceFilePath = path.join(
        CONFIG.outputDir,
        `${sentenceBaseName}.wav`
      )

      // Check if file doesn't exist or is empty
      if (
        !fs.existsSync(sentenceFilePath) ||
        fs.statSync(sentenceFilePath).size < 100
      ) {
        missingTasks.push({
          type: 'sentence',
          text: cleanSentenceSpeech,
          fileName: `${sentenceBaseName}.wav`,
          filePath: sentenceFilePath,
          sourceWord: item.word,
        })
      }
    }
  }

  console.log(`\n🎧 Vlaams Audio Generator (Batch Mode)`)
  console.log(`Voice: ${CONFIG.voiceName} (${CONFIG.voiceStyle})`)
  console.log(`Target Output: ${CONFIG.outputDir}`)
  console.log(`Total missing audio files detected: ${missingTasks.length}`)

  if (missingTasks.length === 0) {
    console.log(`All word and sentence WAV files already exist! Nothing to do.`)
    return
  }

  // 2. Select up to targetNewCount items
  const tasksToProcess = missingTasks.slice(0, targetNewCount)
  const totalBatches = Math.ceil(tasksToProcess.length / CONFIG.batchSize)

  console.log(
    `Requested: ${targetNewCount} new file(s) -> Processing: ${tasksToProcess.length} in ${totalBatches} batch(es)\n`
  )

  let generatedCount = 0

  // 3. Process in batches of 10
  for (let b = 0; b < totalBatches; b++) {
    const startIdx = b * CONFIG.batchSize
    const endIdx = Math.min(startIdx + CONFIG.batchSize, tasksToProcess.length)
    const currentBatch = tasksToProcess.slice(startIdx, endIdx)

    console.log(
      `--- Batch [${b + 1}/${totalBatches}] (${currentBatch.length} items) in 1 API call ---`
    )

    try {
      await synthesizeBatchToFiles(currentBatch, CONFIG.outputDir)
      generatedCount += currentBatch.length
    } catch (err: any) {
      console.error(
        `\x1b[31mBatch ${b + 1} failed:\x1b[0m ${err.message || err}`
      )
    }

    // Delay between consecutive batches if there are more
    if (b < totalBatches - 1) {
      console.log(`Waiting ${CONFIG.batchDelayMs / 1000}s before next batch...`)
      await sleep(CONFIG.batchDelayMs)
    }
  }

  console.log(`\n========================================`)
  console.log(`Summary:`)
  console.log(`  Newly generated: ${generatedCount} file(s)`)
  console.log(
    `  Remaining missing: ${missingTasks.length - generatedCount} file(s)`
  )
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
