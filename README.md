# TOCFL Practice

A local TOCFL Reading practice site. It contains small placeholder sets for
Bands A, B, and C, covering every Reading format found in the downloaded
reference papers. Listening is planned and already has a place in the data
model.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Question data

Question types and starter examples are in [`app/data/questions.ts`](app/data/questions.ts).
The active 300-question mock bank is in [`app/data/bulkQuestions.ts`](app/data/bulkQuestions.ts).

- `readingQuestions` exposes the active question bank to the app.
- `bulkReadingQuestions` contains the level-balanced authored mock bank.
- `readingGroups` holds a passage, notice, picture, or table shared by several
  questions.
- `levelDetails` controls the description shown on the home page.

## Core fields

Every question requires:

| Field | Meaning |
| --- | --- |
| `id` | Unique ID, e.g. `b-06`. |
| `mode` | Use `'reading'` now. `'listening'` is reserved for later. |
| `level` | `'A'`, `'B'`, or `'C'`. |
| `type` | One of the formats below. |
| `section` | Short label above the question, normally in Chinese. |
| `prompt` | The question or instruction. |
| `options` | Answer choices. Option IDs can be `A`–`D`, `A`–`F`, or insertion labels such as `I`–`IV`. |
| `answer` | The correct option ID, or a blank-to-option map for a word bank. |
| `explanation` | Feedback displayed after the attempt. |

Optional fields:

| Field | Use |
| --- | --- |
| `passage` | A text stimulus shown before the prompt. |
| `visual` | An image, scene placeholder, notice, or table. |
| `groupId` | Connects this question to a shared item in `readingGroups`. |
| `blanks` | Blank markers for `word-bank-cloze`, e.g. `['__1__', '__2__']`. |
| `insertionSentence` | The sentence a learner places in a `sentence-insertion` item. |
| `audio` | Future Listening data: `{ src, transcript? }`. |

## Supported Reading formats

| Type | Use it for | Special requirements |
| --- | --- | --- |
| `single-choice` | A standalone sentence or short question. | Normal options. |
| `cloze` | One blank with its own options. | Put a marker such as `__1__` in `passage` if useful. |
| `reading-comprehension` | Text, notice, form, chart, or table comprehension. | Add `passage`, `visual`, or `groupId` as appropriate. |
| `image-choice` | A sentence with picture answers. | Give each option a `visual`. Three options are common in Band A. |
| `picture-description` | One picture with sentence answers. | Add a question-level `visual`. |
| `picture-cloze` | One visual situation plus a blank question. | Add a question-level `visual`; use `groupId` for a set sharing one picture. |
| `word-bank-cloze` | Several blanks sharing a word bank, where each word can be used once. | Add `passage`, `blanks`, 5–6 options, and an answer map. |
| `sentence-insertion` | Choose where a supplied sentence belongs in a passage. | Add `passage`, `insertionSentence`, and position options such as I–IV. |

## Add a normal Reading question

Copy this into `readingQuestions` and change the content:

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

## Add visual material

`visual` has four supported shapes. Use `image` for a real uploaded image and
the other formats for structured placeholder or information visuals.

```ts
visual: { kind: 'image', src: '/images/a-06.jpg', alt: '學生在圖書館讀書' }

visual: { kind: 'scene', emoji: '🏊', label: '游泳池', detail: '朋友們正在游泳' }

visual: { kind: 'notice', title: '公告標題', body: '公告內容', footer: '補充說明' }

visual: {
  kind: 'table',
  title: '表格標題',
  columns: ['項目', '數量'],
  rows: [['甲', '10'], ['乙', '15']],
}
```

For an `image-choice`, put one visual inside each option:

```ts
{
  id: 'a-06', mode: 'reading', level: 'A', type: 'image-choice',
  section: '看句子選圖片', prompt: '他正在吃晚餐。',
  options: [
    { id: 'A', text: '圖 A', visual: { kind: 'scene', emoji: '🍽️', label: '吃飯' } },
    { id: 'B', text: '圖 B', visual: { kind: 'scene', emoji: '🚌', label: '等公車' } },
    { id: 'C', text: '圖 C', visual: { kind: 'scene', emoji: '📚', label: '看書' } },
  ],
  answer: 'A', explanation: '圖片 A 顯示正在吃飯。',
}
```

## Add a shared group

Create the shared material once in `readingGroups`, then attach each related
question through its `groupId`. This is the format used when one notice, chart,
or passage has several questions.

```ts
export const readingGroups: QuestionGroup[] = [
  {
    id: 'b-library-notice',
    title: '閱讀材料（三）',
    visual: { kind: 'notice', title: '圖書館公告', body: '週一休館。' },
  },
];
```

```ts
{
  id: 'b-07', mode: 'reading', level: 'B', type: 'reading-comprehension',
  section: '公告閱讀', groupId: 'b-library-notice',
  prompt: '圖書館什麼時候休館？',
  options: [/* options */], answer: 'A', explanation: '……',
}
```

## Add a word-bank cloze

The `answer` is an object whose keys are the blank markers. The UI prevents a
learner from selecting the same word for two blanks.

```ts
{
  id: 'a-07', mode: 'reading', level: 'A', type: 'word-bank-cloze',
  section: '選詞填空',
  prompt: '請用下方選項完成短文。每個選項只能用一次。',
  passage: '我 __1__ 中文，也 __2__ 日本語。',
  blanks: ['__1__', '__2__'],
  options: [
    { id: 'A', text: '會說' }, { id: 'B', text: '會寫' }, { id: 'C', text: '不會' },
  ],
  answer: { '__1__': 'A', '__2__': 'B' },
  explanation: '依句意完成兩個空格。',
}
```

## Add a sentence insertion item

Use visible markers in the passage and make their IDs match the options.

```ts
{
  id: 'c-04', mode: 'reading', level: 'C', type: 'sentence-insertion',
  section: '句子插入',
  prompt: '請選出最適合插入這個句子的位置。',
  insertionSentence: '因此，這項做法逐漸受到重視。',
  passage: '第一段內容。I 第二段內容。II 第三段內容。III',
  options: [
    { id: 'I', text: '位置 I' }, { id: 'II', text: '位置 II' },
    { id: 'III', text: '位置 III' },
  ],
  answer: 'II',
  explanation: '說明前後句之間的邏輯。',
}
```

## Authoring checklist

1. Use a unique ID and the correct band.
2. Keep a single correct answer; word-bank cloze items use one answer per blank.
3. Use `groupId` instead of copying a shared passage or notice into many questions.
4. Give every real image useful Chinese `alt` text.
5. Add a concise explanation that refers to the evidence.
6. Run `npm run build` after changes.

## Listening later

Listening questions will use the same options, groups, visuals, and answer
rules. Set `mode: 'listening'` and add `audio: { src, transcript? }`. The
current interface intentionally displays Reading items only.

## Reference papers

Representative official Band A, B, and C Reading papers are in
`reference-papers/`. Use them to study formats, but create original practice
content rather than copying official questions.
