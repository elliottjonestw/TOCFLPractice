# TOCFL Practice

A local TOCFL practice site for the Reading and Listening components of Bands
A, B, and C. The question bank is original practice material informed by the
structure of official reference papers.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The listening recordings are committed as static WAV files, so normal local
development does not require a speech service, an API key, or an internet
connection.

## Question data and assets

| Material | Location |
| --- | --- |
| Reading questions and shared groups | [`app/data/questions.ts`](app/data/questions.ts) and [`app/data/bulkQuestions.ts`](app/data/bulkQuestions.ts) |
| Listening question source | [`app/data/listeningQuestions.json`](app/data/listeningQuestions.json) |
| Listening JSON export | [`app/data/listeningQuestions.ts`](app/data/listeningQuestions.ts) |
| Generated listening recordings | [`public/audio/listening/`](public/audio/listening/) |
| Reading images | [`public/images/questions/`](public/images/questions/) |
| Listening images | [`public/images/listening/`](public/images/listening/) |
| Local speech generator | [`scripts/generate-listening-audio.mjs`](scripts/generate-listening-audio.mjs) |

`app/page.tsx` combines the Reading and Listening banks, then filters them by
the learner's selected mode, band, and question type.

## Core question fields

Every question requires:

| Field | Meaning |
| --- | --- |
| `id` | Unique ID, e.g. `lb-09`. |
| `mode` | `'reading'` or `'listening'`. |
| `level` | `'A'`, `'B'`, or `'C'`. |
| `type` | A supported Reading or Listening format. |
| `section` | Short label above the question, normally in Chinese. |
| `prompt` | The instruction or question shown by the UI. For Listening, the spoken question belongs in `audio.transcript`. |
| `options` | Answer choices. Option IDs can be `A`–`D`, `A`–`F`, or insertion labels such as `I`–`IV`. |
| `answer` | The correct option ID, or a blank-to-option map for a word bank. |
| `explanation` | Feedback displayed after the attempt. |

Optional fields:

| Field | Use |
| --- | --- |
| `passage` | A text stimulus shown before the prompt. |
| `visual` | An image, notice, table, or (for legacy Reading items) scene placeholder. |
| `groupId` | Connects a Reading question to shared material in `readingGroups`. |
| `blanks` | Blank markers for `word-bank-cloze`, e.g. `['__1__', '__2__']`. |
| `insertionSentence` | The sentence a learner places in a `sentence-insertion` item. |
| `audio` | Required for Listening: `{ src, transcript, repeats }`. |

## Supported Reading formats

| Type | Use it for | Special requirements |
| --- | --- | --- |
| `single-choice` | A standalone sentence or short question. | Normal options. |
| `cloze` | One blank with its own options. | Put a marker such as `__1__` in `passage` if useful. |
| `reading-comprehension` | Text, notice, form, chart, or table comprehension. | Add `passage`, `visual`, or `groupId` as appropriate. |
| `image-choice` | A sentence with picture answers. | Give each option a `visual`. Three options are common in Band A. |
| `picture-description` | One picture with sentence answers. | Add a question-level `visual`. |
| `picture-cloze` | One visual situation plus a blank question. | Add a question-level `visual`; use `groupId` for a shared picture. |
| `word-bank-cloze` | Several blanks sharing a word bank. | Add `passage`, `blanks`, 5–6 options, and an answer map. |
| `sentence-insertion` | Choose where a supplied sentence belongs in a passage. | Add `passage`, `insertionSentence`, and position options such as I–IV. |

## Listening formats

All Listening recordings are generated locally and need to play before the
learner can submit. `repeats: 2` creates the two-play behaviour used for the
shorter Band A recordings; the other current formats play once.

| Band | Type | Use it for | Choices and playback |
| --- | --- | --- | --- |
| A | `listening-picture-response` | Listen and choose the matching pictured response. | Three visual choices; recording plays twice. |
| A | `listening-single-dialogue` | A short exchange matched to a picture. | Three visual choices; recording plays twice. |
| A | `listening-multiple-dialogue` | A longer multi-turn exchange followed by a question. | Three visual choices; dialogue plays twice, then the learner plays the question separately. |
| A | `listening-dialogue` | A dialogue followed by a spoken question. | Three text choices; dialogue plays once, then the learner plays the question separately. |
| B / C | `listening-dialogue` | A dialogue followed by a spoken question. | Four text choices; dialogue and question are separate players. |
| B / C | `listening-monologue` | A short announcement, report, or monologue followed by a question. | Four text choices; passage and question are separate players. |

For Band A picture-response items, the UI shows choices as `1`, `2`, and
`3`. The recording likewise speaks `一`, `二`, and `三`, rather than
letter names or the longer `選項一` form.

## Add a Listening question

Add authored source data to `app/data/listeningQuestions.json`. Keep the
recording's dialogue or passage separate from its spoken question with a
newline followed by `問題：`:

```json
{
  "id": "lb-09",
  "mode": "listening",
  "level": "B",
  "type": "listening-monologue",
  "section": "第二部分・段落理解",
  "prompt": "聽完問題後，選出最合適的答案。",
  "options": [
    { "id": "A", "text": "星期一" },
    { "id": "B", "text": "星期二" },
    { "id": "C", "text": "星期三" },
    { "id": "D", "text": "星期四" }
  ],
  "answer": "B",
  "explanation": "錄音明確說明活動改到星期二。",
  "audio": {
    "src": "/audio/listening/lb-09.wav",
    "transcript": "活動原定星期一舉行，因為下雨改到星期二。\n問題：活動改到星期幾？",
    "repeats": 1
  }
}
```

When the transcript contains `\n問題：`, the generator writes two clips:

- `lb-09.wav` contains only the dialogue or passage.
- `lb-09-question.wav` contains only the spoken question.

The listening UI unlocks the question player after the main clip completes,
then requires both clips to finish before the learner answers. If a question
does not need a separately spoken question, omit that delimiter and only its
main audio file is used.

The `src` value must match the question ID and generated filename. Use `1`,
`2`, and `3` in Band A visual-option text if the recording reads those
numbers; the application preserves the internal option IDs for scoring.

## Generate or regenerate Listening audio

Run this after adding or changing Listening transcripts:

```bash
npm run generate:listening-audio
```

For a quick edit-and-check cycle, regenerate selected IDs only:

```bash
TOCFL_AUDIO_IDS=la-05,lb-03 npm run generate:listening-audio
```

The script uses the local Piper neural Mandarin voice
`zh_CN-huayan-medium`. On its first run it downloads Piper and the voice model
to `.local-tts/`, which is intentionally ignored by Git. It synthesizes short
utterances and joins them with natural pauses, including a short pause after
spoken answer numbers. This avoids the static that can occur when a long
recording is synthesized in one pass.

Do not hand-edit the generated WAV files. Change the JSON transcript, run the
generator, and test the relevant item in the browser. The generated assets in
`public/audio/listening/` are what the app serves.

## Add visual material

Use real generated or uploaded images for Listening visual choices, not emoji
scene placeholders. Place the asset under `public/images/listening/` and give
it a useful Chinese `alt` description:

```ts
visual: {
  kind: 'image',
  src: '/images/listening/cinema.png',
  alt: '電影院入口與售票櫃檯',
}
```

For a visual-choice item, put one image inside every option. The image card
already displays the option number/letter, so do not repeat the same label in
the image caption or option text.

```ts
options: [
  {
    id: 'A',
    text: '1',
    visual: { kind: 'image', src: '/images/listening/car-city.png', alt: '城市街道上的汽車' },
  },
  {
    id: 'B',
    text: '2',
    visual: { kind: 'image', src: '/images/listening/cinema.png', alt: '電影院入口' },
  },
]
```

Other useful `visual` shapes for Reading material are:

```ts
visual: { kind: 'notice', title: '公告標題', body: '公告內容', footer: '補充說明' }

visual: {
  kind: 'table',
  title: '表格標題',
  columns: ['項目', '數量'],
  rows: [['甲', '10'], ['乙', '15']],
}
```

## Add a normal Reading question

Copy this into the Reading bank and change the content:

```ts
{
  id: 'b-06',
  mode: 'reading',
  level: 'B',
  type: 'reading-comprehension',
  section: '閱讀理解',
  passage: '圖書館週一休館，其他日子上午九點到下午九點開放。',
  prompt: '圖書館什麼時候休館？',
  options: [
    { id: 'A', text: '星期一' },
    { id: 'B', text: '星期二' },
    { id: 'C', text: '每天上午' },
    { id: 'D', text: '每天晚上' },
  ],
  answer: 'A',
  explanation: '短文第一句說圖書館週一休館。',
}
```

## Add a shared Reading group

Create the shared material once in `readingGroups`, then attach each related
question through its `groupId`. This is useful when one notice, chart, or
passage has several questions.

```ts
export const readingGroups: QuestionGroup[] = [
  {
    id: 'b-library-notice',
    title: '閱讀材料（三）',
    visual: { kind: 'notice', title: '圖書館公告', body: '週一休館。' },
  },
];
```

## Authoring checklist

1. Use a unique ID, correct band, mode, and type.
2. Keep a single correct answer; word-bank cloze items use one answer per blank.
3. Use `groupId` instead of copying shared Reading material into many questions.
4. Give every image useful Chinese `alt` text; Listening visual options should use generated/uploaded images rather than emoji.
5. For Listening, include `audio.src`, `audio.transcript`, and `repeats`; use `\n問題：` whenever the spoken question needs its own player.
6. Regenerate the affected audio, then listen through the whole item for clear speech and correct pauses.
7. Add a concise explanation that refers to the evidence, then run `npm run lint` and `npm run build`.

## Reference papers

Representative official Band A, B, and C papers are in `reference-papers/`.
Use them to study formats, but create original practice content rather than
copying official questions.
