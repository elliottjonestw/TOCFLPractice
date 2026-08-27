#!/usr/bin/env node

/**
 * Generates the site recordings locally with Piper's neural Mandarin voice.
 *
 * The model is kept outside version control in .local-tts/. This makes audio
 * regeneration deterministic and keeps the application fully static at run
 * time: no hosted TTS account, API key, or browser synthesis is involved.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const modelDirectory = join(root, ".local-tts", "piper-zh-cn-huayan-medium");
const model = join(modelDirectory, "zh_CN-huayan-medium.onnx");
const config = `${model}.json`;
const outputDirectory = join(root, "public", "audio", "listening");
const allQuestions = JSON.parse(
  readFileSync(join(root, "app", "data", "listeningQuestions.json"), "utf8"),
);
const requestedIds = process.env.TOCFL_AUDIO_IDS?.split(",").filter(Boolean);
const questions = requestedIds
  ? allQuestions.filter((question) => requestedIds.includes(question.id))
  : allQuestions;
if (!questions.length) throw new Error("No listening questions matched TOCFL_AUDIO_IDS.");

function download(url, destination) {
  console.log(`Downloading ${destination.replace(`${root}/`, "")}…`);
  execFileSync("curl", ["--fail", "--location", "--retry", "3", "-o", destination, url], {
    stdio: "inherit",
  });
}

function ensureModel() {
  mkdirSync(modelDirectory, { recursive: true });
  if (!existsSync(model)) {
    download(
      "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx?download=true",
      model,
    );
  }
  if (!existsSync(config)) {
    download(
      "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx.json?download=true",
      config,
    );
  }
}

function spokenSegments(transcript) {
  // Speaker labels are helpful in a revealed transcript but should not be
  // narrated by the single neural voice. Punctuation gives Piper natural turns.
  const spokenOptions = transcript.replace(
    /(^|[\s，。！？\n])([ABCD])(?=[，。！？\s\n])/g,
    (_match, prefix, letter) =>
      `${prefix}${({ A: "一", B: "二", C: "三", D: "四" })[letter]}`,
  );
  const rawSegments = spokenOptions
    .replaceAll(/(^|\n)(男|女)：/g, "$1")
    .split(/[，、；：。！？\n]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  // A standalone one-character numeral is too brief for this model to render
  // consistently. Keep it with the answer it introduces, while an ellipsis
  // creates the short exam-style pause: 「一……水果」.
  const segments = [];
  for (let index = 0; index < rawSegments.length; index += 1) {
    if (/^[一二三四]$/.test(rawSegments[index]) && rawSegments[index + 1]) {
      segments.push(`${rawSegments[index]}……${rawSegments[index + 1]}`);
      index += 1;
    } else {
      segments.push(rawSegments[index]);
    }
  }
  // Two short phrases per neural-TTS pass keep a natural rhythm while making
  // a large authored bank practical to regenerate. Each pass stays far below
  // the long input length that previously produced static.
  return Array.from({ length: Math.ceil(segments.length / 2) }, (_, index) =>
    segments.slice(index * 2, index * 2 + 2).join("。"),
  );
}

function pcmFromWav(file) {
  const buffer = readFileSync(file);
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`Unsupported WAV output: ${file}`);
  }
  let offset = 12;
  let format;
  let data;
  while (offset < buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const value = buffer.subarray(offset + 8, offset + 8 + size);
    if (id === "fmt ") format = value;
    if (id === "data") data = value;
    offset += 8 + size + (size % 2);
  }
  if (!format || !data) throw new Error(`WAV is missing audio data: ${file}`);
  return { format, data };
}

function writePcmWav(destination, format, chunks) {
  const data = Buffer.concat(chunks);
  const header = Buffer.alloc(20);
  header.write("RIFF", 0);
  header.writeUInt32LE(4 + 8 + format.length + 8 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(format.length, 16);
  const dataHeader = Buffer.alloc(8);
  dataHeader.write("data", 0);
  dataHeader.writeUInt32LE(data.length, 4);
  writeFileSync(destination, Buffer.concat([header, format, dataHeader, data]));
}

function silence(seconds, format) {
  const channels = format.readUInt16LE(2);
  const sampleRate = format.readUInt32LE(4);
  const bits = format.readUInt16LE(14);
  return Buffer.alloc(Math.round(seconds * sampleRate * channels * (bits / 8)));
}

ensureModel();
mkdirSync(outputDirectory, { recursive: true });

const temporaryDirectory = mkdtempSync(join(tmpdir(), "tocfl-listening-"));
try {
  const recordings = [];
  for (const question of questions) {
    const [promptTranscript, questionTranscript] = question.audio.transcript.split("\n問題：");
    const sources = [
      { id: question.id, transcript: promptTranscript, repeats: question.audio.repeats },
      ...(questionTranscript
        ? [{ id: `${question.id}-question`, transcript: `問題：${questionTranscript}`, repeats: 1 }]
        : []),
    ];
    for (const recording of sources) {
      recordings.push({
        ...recording,
        level: question.level,
        destination: join(outputDirectory, `${recording.id}.wav`),
        segments: spokenSegments(recording.transcript),
      });
    }
  }

  // Piper can write one WAV per input line while keeping the voice model
  // loaded. The individual utterances remain short (preventing static), but
  // a complete authored bank no longer pays the model-startup cost per line.
  const utterances = [];
  for (const recording of recordings) {
    const runs = recording.repeats === 2 ? 2 : 1;
    console.log(`Queueing ${recording.id}.wav (${recording.segments.length} short utterances)`);
    for (let run = 0; run < runs; run += 1) {
      for (const segment of recording.segments) utterances.push({ recording, segment });
    }
  }
  const inputFile = join(temporaryDirectory, "utterances.txt");
  const renderedDirectory = join(temporaryDirectory, "rendered");
  writeFileSync(inputFile, utterances.map(({ segment }) => `${segment}。`).join("\n"));
  mkdirSync(renderedDirectory, { recursive: true });
  execFileSync(
    "piper",
    [
      "--model",
      model,
      "--config",
      config,
      "--input-file",
      inputFile,
      "--output-dir",
      renderedDirectory,
      "--output-dir-naming",
      "timestamp",
      "--length-scale",
      questions[0]?.level === "A" ? "1.05" : "0.9",
      "--sentence-silence",
      "0",
    ],
    { stdio: "ignore" },
  );
  const renderedFiles = readdirSync(renderedDirectory).sort();
  if (renderedFiles.length !== utterances.length) {
    throw new Error(`Expected ${utterances.length} utterances, received ${renderedFiles.length}.`);
  }
  const rendered = renderedFiles.map((file) => pcmFromWav(join(renderedDirectory, file)));
  let renderedIndex = 0;
  let generatedRecordings = 0;
  for (const recording of recordings) {
    const allChunks = [];
    let format;
    const runs = recording.repeats === 2 ? 2 : 1;
    for (let run = 0; run < runs; run += 1) {
      for (let segmentIndex = 0; segmentIndex < recording.segments.length; segmentIndex += 1) {
        const wav = rendered[renderedIndex];
        renderedIndex += 1;
        format ??= wav.format;
        allChunks.push(wav.data);
        if (segmentIndex < recording.segments.length - 1) allChunks.push(silence(0.38, format));
      }
      if (run < runs - 1) allChunks.push(silence(5, format));
    }
    writePcmWav(recording.destination, format, allChunks);
    generatedRecordings += 1;
  }
  console.log(`\nGenerated ${generatedRecordings} local recordings in public/audio/listening.`);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
