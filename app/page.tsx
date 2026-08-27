"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import styles from "./page.module.css";
import {
  levelDetails,
  readingGroups,
  readingQuestions,
  type Question,
  type QuestionType,
  type TestMode,
  type TocflLevel,
  type Visual,
} from "./data/questions";
import { listeningQuestions } from "./data/listeningQuestions";

type Answer = string | Record<string, string>;
const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const typeLabels: Record<QuestionType, string> = {
  "single-choice": "Single choice",
  cloze: "Single blank",
  "reading-comprehension": "Reading comprehension",
  "image-choice": "Sentence → image",
  "picture-description": "Image → sentence",
  "picture-cloze": "Picture cloze",
  "word-bank-cloze": "Shared word bank",
  "sentence-insertion": "Sentence insertion",
  "listening-picture-response": "Picture response",
  "listening-single-dialogue": "Single-turn dialogue",
  "listening-multiple-dialogue": "Four-turn dialogue",
  "listening-dialogue": "Dialogue",
  "listening-monologue": "Monologue",
};

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
const readingSecondsPerQuestion = 72;
const listeningSecondsPerQuestion = 78;
const allQuestions = [...readingQuestions, ...listeningQuestions];
const firstBlank = (question?: Question) => question?.blanks?.[0] ?? "";
const getSavedLevel = (): TocflLevel => {
  if (typeof window === "undefined") return "A";
  const savedLevel =
    window.localStorage.getItem("tocfl-practice:last-level") ||
    window.localStorage.getItem("tocfl-practice:last-reading-level");
  return savedLevel === "A" || savedLevel === "B" || savedLevel === "C"
    ? savedLevel
    : "A";
};
const subscribeToSavedLevel = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
};
const typesForLevel = (level: TocflLevel, mode: TestMode) =>
  Array.from(
    new Set(
      allQuestions
        .filter((item) => item.level === level && item.mode === mode)
        .map((item) => item.type),
    ),
  );
const shuffleQuestions = (questions: Question[]) => {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[nextIndex]] = [
      shuffled[nextIndex],
      shuffled[index],
    ];
  }
  return shuffled;
};

const questionBankNumbers = new Map<string, number>();
(["A", "B", "C"] as TocflLevel[]).forEach((level) => {
  allQuestions
    .filter((question) => question.level === level)
    .forEach((question, index) => questionBankNumbers.set(question.id, index + 1));
});
const groupsById = new Map(readingGroups.map((group) => [group.id, group]));

function VisualStimulus({ visual }: { visual: Visual }) {
  if (visual.kind === "image")
    return (
      <figure className="visual-stimulus image-stimulus">
        <Image
          src={`${publicBasePath}${visual.src}`}
          alt={visual.alt}
          width={1200}
          height={800}
          sizes="(max-width: 820px) 100vw, 680px"
          unoptimized
        />
        <figcaption>{visual.caption || visual.alt}</figcaption>
      </figure>
    );
  if (visual.kind === "scene")
    return (
      <figure className="visual-stimulus scene-stimulus">
        <span aria-hidden="true">{visual.emoji}</span>
        <figcaption>
          <b>{visual.label}</b>
          {visual.detail && <small>{visual.detail}</small>}
        </figcaption>
      </figure>
    );
  if (visual.kind === "notice")
    return (
      <article className="visual-stimulus notice-stimulus">
        <p>{visual.eyebrow}</p>
        <h2>{visual.title}</h2>
        <div>{visual.body}</div>
        {visual.footer && <footer>{visual.footer}</footer>}
      </article>
    );
  return (
    <figure className="visual-stimulus table-stimulus">
      <figcaption>{visual.title}</figcaption>
      <table>
        <thead>
          <tr>
            {visual.columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visual.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function isComplete(question: Question, answer?: Answer) {
  if (!answer) return false;
  if (typeof answer === "string") return true;
  return (question.blanks || []).every((blank) => answer[blank]);
}

function isCorrect(question: Question, answer?: Answer) {
  if (!answer) return false;
  if (typeof question.answer === "string") return answer === question.answer;
  if (typeof answer === "string") return false;
  return Object.entries(question.answer).every(
    ([blank, option]) => answer[blank] === option,
  );
}

function englishExplanation(question: Question) {
  const option =
    typeof question.answer === "string" ? `Option ${question.answer}` : "The correct choices";

  switch (question.type) {
    case "image-choice":
      return `${option} matches the sentence.`;
    case "picture-description":
      return `${option} accurately describes the picture.`;
    case "picture-cloze":
      return `${option} best completes the sentence and matches the picture.`;
    case "word-bank-cloze":
      return "The correct choices complete every blank with the intended meaning and grammar.";
    case "sentence-insertion":
      return `${option} creates the most coherent passage.`;
    case "cloze":
      return `${option} best completes the sentence.`;
    default:
      return `${option} is supported by the information in the question.`;
  }
}

function visualDescription(visual?: Visual) {
  if (!visual) return "";
  if (visual.kind === "image") return visual.caption || visual.alt;
  if (visual.kind === "scene")
    return [visual.label, visual.detail].filter(Boolean).join(" — ");
  if (visual.kind === "notice") return `${visual.title}: ${visual.body}`;
  return `${visual.title}: ${visual.columns.join(", ")}`;
}

function answerDescription(question: Question, answer: Answer) {
  const optionDescription = (optionId: string) => {
    const option = question.options.find((item) => item.id === optionId);
    return `Option ${optionId}${option ? `: ${option.text}` : ""}`;
  };

  if (typeof answer === "string") return optionDescription(answer);
  return Object.entries(answer)
    .map(([blank, optionId]) => `${blank}: ${optionDescription(optionId)}`)
    .join("\n");
}

function aiExplanationPrompt(
  question: Question,
  answer: Answer,
  visual?: Visual,
) {
  const options = question.options
    .map(
      (option) =>
        `Option ${option.id}: ${option.text}${option.visual ? ` (image: ${visualDescription(option.visual)})` : ""}`,
    )
    .join("\n");
  const correctAnswer = answerDescription(question, question.answer);

  return [
    "You are a patient TOCFL Chinese tutor. Explain this submitted quiz question in English for a Chinese learner.",
    "State why the correct answer works, why the student's answer is right or wrong, and explain useful vocabulary or grammar briefly. Keep the answer concise and supportive.",
    `Question type: ${question.section}`,
    `Question: ${question.prompt}`,
    question.passage ? `Passage: ${question.passage}` : "",
    visual ? `Visual information: ${visualDescription(visual)}` : "",
    `Answer options:\n${options}`,
    `Student's submitted answer:\n${answerDescription(question, answer)}`,
    `Correct answer:\n${correctAnswer}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export default function Home() {
  const savedLevel = useSyncExternalStore<TocflLevel>(
    subscribeToSavedLevel,
    getSavedLevel,
    () => "A",
  );
  const [screen, setScreen] = useState<"welcome" | "exam" | "results">(
    "welcome",
  );
  const [selectedLevel, setSelectedLevel] = useState<TocflLevel | null>(null);
  const [selectedMode, setSelectedMode] = useState<TestMode>("reading");
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[] | null>(
    null,
  );
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [submittedAnswers, setSubmittedAnswers] = useState<
    Record<string, boolean>
  >({});
  const [activeBlank, setActiveBlank] = useState("");
  const [textSize, setTextSize] = useState(0);
  const [seconds, setSeconds] = useState(10 * readingSecondsPerQuestion);
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);
  const [questionCount, setQuestionCount] = useState(10);
  const [recordingPlays, setRecordingPlays] = useState(0);
  const [isRecordingPlaying, setIsRecordingPlaying] = useState(false);
  const [recordingFinished, setRecordingFinished] = useState(false);
  const [questionRecordingPlays, setQuestionRecordingPlays] = useState(0);
  const [isQuestionRecordingPlaying, setIsQuestionRecordingPlaying] =
    useState(false);
  const [questionRecordingFinished, setQuestionRecordingFinished] =
    useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const questionAudioRef = useRef<HTMLAudioElement>(null);
  const level = selectedLevel ?? savedLevel;
  const activeSelectedTypes = selectedTypes ?? typesForLevel(level, selectedMode);
  const availableTypes = useMemo(
    () => typesForLevel(level, selectedMode),
    [level, selectedMode],
  );
  const questionPool = useMemo(
    () =>
      allQuestions.filter(
        (item) =>
          item.level === level &&
          item.mode === selectedMode &&
          activeSelectedTypes.includes(item.type),
      ),
    [activeSelectedTypes, level, selectedMode],
  );
  const questions = screen === "welcome" ? questionPool : sessionQuestions;
  const maxQuizLength = Math.max(questionPool.length, 1);
  const quizLength = Math.min(Math.max(questionCount, 1), maxQuizLength);
  const quizLengthPercentage =
    maxQuizLength > 1 ? ((quizLength - 1) / (maxQuizLength - 1)) * 100 : 100;
  const secondsPerQuestion =
    selectedMode === "listening"
      ? listeningSecondsPerQuestion
      : readingSecondsPerQuestion;
  const sessionDuration = quizLength * secondsPerQuestion;
  const question = questions[index];
  const questionBankNumber = question ? questionBankNumbers.get(question.id) : 0;
  const group = question?.groupId ? groupsById.get(question.groupId) : undefined;
  const passage = question?.passage || group?.passage;
  const visual = question?.visual || group?.visual;
  const answer = question ? answers[question.id] : undefined;
  const isSubmitted = question ? Boolean(submittedAnswers[question.id]) : false;
  const answerIsCorrect = question ? isCorrect(question, answer) : false;
  const aiExplanationUrl =
    question && answer
      ? `https://chat.openai.com/?model=gpt-4&q=${encodeURIComponent(aiExplanationPrompt(question, answer, visual))}`
      : "";
  const answered = questions.filter((item) =>
    submittedAnswers[item.id],
  ).length;

  useEffect(() => {
    if (screen !== "exam" || seconds === 0) return;
    const timer = window.setInterval(
      () => setSeconds((value) => Math.max(value - 1, 0)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [screen, seconds]);

  function begin() {
    if (!questionPool.length) return;
    const nextQuestions = shuffleQuestions(questionPool).slice(0, quizLength);
    setAnswers({});
    setSubmittedAnswers({});
    setIndex(0);
    setSeconds(sessionDuration);
    setActiveBlank(firstBlank(nextQuestions[0]));
    setRecordingPlays(0);
    setIsRecordingPlaying(false);
    setRecordingFinished(false);
    setQuestionRecordingPlays(0);
    setIsQuestionRecordingPlaying(false);
    setQuestionRecordingFinished(false);
    setSessionQuestions(nextQuestions);
    setScreen("exam");
  }

  function pickLevel(next: TocflLevel) {
    setSelectedLevel(next);
    setSelectedTypes(typesForLevel(next, selectedMode));
    window.localStorage.setItem("tocfl-practice:last-level", next);
    setIndex(0);
  }

  function pickMode(next: TestMode) {
    setSelectedMode(next);
    setSelectedTypes(typesForLevel(level, next));
    setQuestionCount(10);
    setIndex(0);
  }

  function goToQuestion(nextIndex: number) {
    audioRef.current?.pause();
    questionAudioRef.current?.pause();
    setIndex(nextIndex);
    setActiveBlank(firstBlank(sessionQuestions[nextIndex]));
    setRecordingPlays(0);
    setIsRecordingPlaying(false);
    setRecordingFinished(false);
    setQuestionRecordingPlays(0);
    setIsQuestionRecordingPlaying(false);
    setQuestionRecordingFinished(false);
  }

  function toggleType(type: QuestionType) {
    setSelectedTypes((current) => {
      const activeTypes = current ?? typesForLevel(level, selectedMode);
      return activeTypes.includes(type)
        ? activeTypes.filter((item) => item !== type)
        : [...activeTypes, type];
    });
    setIndex(0);
  }

  function choose(optionId: string) {
    if (!question || isSubmitted) return;
    if (question.type === "word-bank-cloze") {
      setAnswers((current) => {
        const previousAnswer = current[question.id];
        const previousBlanks: Record<string, string> =
          typeof previousAnswer === "string" || !previousAnswer
            ? {}
            : previousAnswer;
        return {
          ...current,
          [question.id]: {
            ...previousBlanks,
            [activeBlank]: optionId,
          },
        };
      });
    } else {
      setAnswers((current) => ({ ...current, [question.id]: optionId }));
    }
  }

  function submitAnswer() {
    if (
      !question ||
      !isComplete(question, answer) ||
      (question.mode === "listening" &&
        (recordingPlays === 0 ||
          (question.audio?.transcript?.includes("\n問題：") &&
            !questionRecordingFinished)))
    )
      return;
    setSubmittedAnswers((current) => ({ ...current, [question.id]: true }));
  }

  function playRecording() {
    if (!audioRef.current || !question?.audio || recordingPlays > 0) return;
    audioRef.current.currentTime = 0;
    setRecordingPlays(1);
    setIsRecordingPlaying(true);
    void audioRef.current.play().catch(() => setIsRecordingPlaying(false));
  }

  function playQuestionRecording() {
    if (
      !questionAudioRef.current ||
      !question?.audio ||
      !recordingFinished ||
      questionRecordingPlays > 0
    )
      return;
    questionAudioRef.current.currentTime = 0;
    setQuestionRecordingPlays(1);
    setIsQuestionRecordingPlaying(true);
    void questionAudioRef.current
      .play()
      .catch(() => setIsQuestionRecordingPlaying(false));
  }

  function passageWithBlanks(value: string) {
    if (!question || question.type !== "word-bank-cloze") return value;
    const selected = typeof answer === "string" ? {} : answer || {};
    return value.split(/(__\d+__)/g).map((part, partIndex) =>
      part.match(/^__\d+__$/) ? (
        <button
          key={`${part}-${partIndex}`}
          onClick={() => setActiveBlank(part)}
          className={`inline-blank ${activeBlank === part ? "active" : ""}`}
        >
          {selected[part]
            ? question.options.find((option) => option.id === selected[part])
                ?.text
            : part.replaceAll("_", " ")}
        </button>
      ) : (
        part
      ),
    );
  }

  if (screen === "results") {
    const correct = questions.filter(
      (item) => submittedAnswers[item.id] && isCorrect(item, answers[item.id]),
    ).length;
    const scorePercentage = questions.length
      ? (correct / questions.length) * 100
      : 0;
    return (
      <main className="app-shell result-shell">
        <section className="result-card">
          <p className="eyebrow">PRACTICE COMPLETE</p>
          <h1>{levelDetails[level].name} {selectedMode === "listening" ? "Listening" : "Reading"}</h1>
          <div
            className="score-ring"
            style={{
              background: `conic-gradient(from -90deg, var(--pine) 0 ${scorePercentage}%, var(--mint) ${scorePercentage}% 100%)`,
            }}
          >
            <strong>{correct}</strong>
            <span>of {questions.length}</span>
          </div>
          <p className="result-copy">
            You got {correct} out of {questions.length} correct.
          </p>
          <button className="primary-button" onClick={begin}>
            Try another set <span>→</span>
          </button>
          <button className="text-button" onClick={() => setScreen("welcome")}>
            Back to practice home
          </button>
        </section>
      </main>
    );
  }

  if (screen === "exam" && question) {
    const isListening = question.mode === "listening";
    const hasVisualOptions = question.options.some((option) => option.visual);
    const hasSeparateQuestion = Boolean(
      question.audio?.transcript?.includes("\n問題："),
    );
    const usedOptions =
      question.type === "word-bank-cloze" && typeof answer !== "string"
        ? Object.values(answer || {})
        : [];
    return (
      <main className={`exam-shell text-size-${textSize}`}>
        <header className={`exam-header ${styles.examHeader}`}>
          <div className={`exam-title ${styles.examTitle}`}>
            <b>{isListening ? "Listening Practice" : "Reading Practice"}</b>
            <span>
              {levelDetails[level].name} · {levelDetails[level].label}
            </span>
          </div>
        </header>
        <div className="exam-progress">
          <div
            style={{ width: `${((index + 1) / questions.length) * 100}%` }}
          />
        </div>
        <div className="exam-layout">
          <aside className="question-nav">
            <p>QUESTIONS</p>
            <div className={`number-grid ${styles.numberGrid}`}>
              {questions.map((item, itemIndex) => (
                <button
                  key={item.id}
                  onClick={() => goToQuestion(itemIndex)}
                  disabled={!isSubmitted && itemIndex > index}
                  className={`${index === itemIndex ? "active" : ""} ${submittedAnswers[item.id] ? styles.answered : ""}`}
                >
                  {itemIndex + 1}
                </button>
              ))}
            </div>
            <div className="nav-key">
              <i className="key-current" /> Current{" "}
              <i className={`key-answered ${styles.answeredKey}`} /> Answered
            </div>
          </aside>
          <section className="question-panel">
            <div className="question-meta">
              <span>{question.section}</span>
              <span>
                Question {index + 1} of {questions.length} · Question ID:{" "}
                {questionBankNumber}
              </span>
            </div>
            <div className="question-number">
              {String(index + 1).padStart(2, "0")}
            </div>
            {group && (
              <div className="group-label">{group.title} · shared material</div>
            )}
            {isListening && question.audio && (
              <section className="listening-player" aria-label="Listening recording">
                <div>
                  <span className="listening-player-label">OFFICIAL-STYLE PLAYBACK</span>
                  <b>{question.audio.repeats === 2 ? "The recording includes two plays." : "The recording plays once."}</b>
                  <small>
                    {recordingPlays
                      ? isRecordingPlaying
                        ? "Recording in progress…"
                        : recordingFinished
                          ? hasSeparateQuestion
                            ? "Now play the question."
                            : "Recording played. Choose your answer."
                          : "Finish the recording to continue."
                      : "Start the recording before you answer."}
                  </small>
                </div>
                <button
                  type="button"
                  className="recording-button"
                  onClick={playRecording}
                  disabled={recordingPlays > 0}
                >
                  {isRecordingPlaying ? "◼ Playing" : recordingPlays ? "✓ Played" : "▶ Play recording"}
                </button>
                <audio
                  ref={audioRef}
                  src={`${publicBasePath}${question.audio.src}`}
                  preload="auto"
                  onEnded={() => {
                    setIsRecordingPlaying(false);
                    setRecordingFinished(true);
                  }}
                  onPause={() => setIsRecordingPlaying(false)}
                />
              </section>
            )}
            {isListening && question.audio && hasSeparateQuestion && (
              <section
                className="listening-player listening-question-player"
                aria-label="Question recording"
              >
                <div>
                  <span className="listening-player-label">STEP 2 · QUESTION</span>
                  <b>Play the spoken question.</b>
                  <small>
                    {!recordingFinished
                      ? "Available after the dialogue or passage finishes."
                      : questionRecordingPlays
                        ? isQuestionRecordingPlaying
                          ? "Question in progress…"
                          : questionRecordingFinished
                            ? "Question played. Choose your answer."
                            : "Finish the question to continue."
                        : "Listen to the question before answering."}
                  </small>
                </div>
                <button
                  type="button"
                  className="recording-button"
                  onClick={playQuestionRecording}
                  disabled={!recordingFinished || questionRecordingPlays > 0}
                >
                  {isQuestionRecordingPlaying
                    ? "◼ Playing"
                    : questionRecordingPlays
                      ? "✓ Played"
                      : "▶ Play question"}
                </button>
                <audio
                  ref={questionAudioRef}
                  src={`${publicBasePath}/audio/listening/${question.id}-question.wav`}
                  preload="auto"
                  onEnded={() => {
                    setIsQuestionRecordingPlaying(false);
                    setQuestionRecordingFinished(true);
                  }}
                  onPause={() => setIsQuestionRecordingPlaying(false)}
                />
              </section>
            )}
            {visual && <VisualStimulus visual={visual} />}
            {question.insertionSentence && (
              <aside className="insertion-sentence">
                <span>INSERT THIS SENTENCE</span>
                {question.insertionSentence}
              </aside>
            )}
            {passage && (
              <article
                className={`passage ${question.type === "word-bank-cloze" ? "cloze-passage" : ""}`}
              >
                {passageWithBlanks(passage)}
              </article>
            )}
            {!isListening && <h1>{question.prompt}</h1>}
            {isListening && !isSubmitted && (
              <h1 className="listening-instruction">
                Listen to the recording, then choose the best answer.
              </h1>
            )}
            {question.type === "word-bank-cloze" && (
              <p className="blank-helper">
                Choose a blank in the passage, then choose one unused answer.
              </p>
            )}
            <div
              className={`answer-list ${hasVisualOptions ? "image-answer-list" : ""}`}
              role="radiogroup"
              aria-label="Answer options"
            >
              {question.options.map((option, optionIndex) => {
                const selected =
                  question.type === "word-bank-cloze" &&
                  typeof answer !== "string"
                    ? answer?.[activeBlank] === option.id
                    : answer === option.id;
                const unavailable =
                  question.type === "word-bank-cloze" &&
                  usedOptions.includes(option.id) &&
                  !selected;
                const isCorrectOption =
                  typeof question.answer === "string"
                    ? question.answer === option.id
                    : Object.values(question.answer).includes(option.id);
                return (
                  <button
                    key={option.id}
                    onClick={() => choose(option.id)}
                    disabled={!isSubmitted && unavailable}
                    className={`${selected ? "selected" : ""} ${isSubmitted && isCorrectOption ? "submitted-correct" : ""} ${isSubmitted && selected && !isCorrectOption ? "submitted-incorrect" : ""}`}
                    role="radio"
                    aria-checked={selected}
                    aria-disabled={isSubmitted || unavailable}
                  >
                    <span>
                      {isListening &&
                      question.type === "listening-picture-response"
                        ? optionIndex + 1
                        : option.id}
                    </span>
                    {option.visual && <VisualStimulus visual={option.visual} />}
                    <b>{option.visual ? option.text : null}</b>
                    {!option.visual &&
                      (isListening && question.type === "listening-picture-response"
                        ? "Audio option"
                        : option.text)}
                  </button>
                );
              })}
            </div>
            {isSubmitted && (
              <>
                {isListening && question.audio?.transcript && (
                  <article className="listening-transcript">
                    <span>REVEAL TRANSCRIPT</span>
                    <p>{question.audio.transcript}</p>
                    <h1>{question.prompt}</h1>
                  </article>
                )}
                <div
                  className={`answer-feedback ${answerIsCorrect ? "correct" : "incorrect"}`}
                  role="status"
                >
                  <strong>{answerIsCorrect ? "Correct" : "Not quite"}</strong>
                  <span>{englishExplanation(question)}</span>
                </div>
                <a
                  className="secondary-button ai-explain-button"
                  href={aiExplanationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Explain this question with AI <span aria-hidden="true">↗</span>
                </a>
              </>
            )}
            <footer className="question-footer">
              <button
                className="secondary-button"
                disabled={index === 0}
                onClick={() => goToQuestion(index - 1)}
              >
                ← Previous
              </button>
              {!isSubmitted ? (
                <button
                  className="primary-button"
                  disabled={
                    !isComplete(question, answer) ||
                    (isListening &&
                      (recordingPlays === 0 ||
                        (hasSeparateQuestion && !questionRecordingFinished)))
                  }
                  onClick={submitAnswer}
                >
                  Submit answer <span>→</span>
                </button>
              ) : index === questions.length - 1 ? (
                <button
                  className="primary-button"
                  onClick={() => setScreen("results")}
                >
                  Finish practice <span>→</span>
                </button>
              ) : (
                <button
                  className="primary-button"
                  onClick={() => goToQuestion(index + 1)}
                >
                  Next question <span>→</span>
                </button>
              )}
            </footer>
          </section>
          <aside className="exam-summary">
            <div className={styles.summaryActions}>
              <div
                className="text-size-control"
                role="group"
                aria-label="Text size"
              >
                <button
                  type="button"
                  onClick={() =>
                    setTextSize((current) => Math.max(0, current - 1))
                  }
                  disabled={textSize === 0}
                  aria-label="Decrease text size"
                >
                  A−
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setTextSize((current) => Math.min(2, current + 1))
                  }
                  disabled={textSize === 2}
                  aria-label="Increase text size"
                >
                  A+
                </button>
              </div>
              <div className="timer">
                <span>◷</span> {formatTime(seconds)}
              </div>
            </div>
            <div>
              <p>ANSWERED</p>
              <strong>
                {answered}
                <small> / {questions.length}</small>
              </strong>
            </div>
            <p>You can change an answer at any time before you finish.</p>
            <button onClick={() => setScreen("results")}>
              End practice early
            </button>
          </aside>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="brand-header">
        <button className="brand">
          <span className="brand-mark">華</span>
          <span>
            TOCFL
            <br />
            <em>Practice</em>
          </span>
        </button>
        <nav>
          <a href="#practice">Practice</a>
          <a href="#about">How it works</a>
        </nav>
      </header>
      <section className="hero" id="practice">
        <div className="hero-copy">
          <p className="eyebrow">PREPARE WITH PURPOSE</p>
          <h1>
            Practice Chinese
            <br />
            <i>like it counts.</i>
          </h1>
          <p className="hero-description">
            Focused TOCFL practice that feels calm, clear, and close to test
            day. Train the reading and listening formats you will meet on test day.
          </p>
          <div className="hero-note">
            <span>⌁</span>
            <p>
              <b>Built for the real rhythm of the exam</b>
              <br />
              Visual prompts, shared reading materials, flexible options, and
              level-aware question types.
            </p>
          </div>
        </div>
        <div className="mode-card">
          <div className="mode-card-head">
            <div>
              <h2>What would you like to practise?</h2>
            </div>
          </div>
          <div className="mode-select">
            <button
              className={`mode-option ${selectedMode === "reading" ? "selected" : ""}`}
              onClick={() => pickMode("reading")}
            >
              <span className="mode-icon">文</span>
              <span>
                <b>Reading</b>
                <small>閱讀測驗 · Original practice questions</small>
              </span>
              <i>{selectedMode === "reading" ? "✓" : "→"}</i>
            </button>
            <button
              className={`mode-option ${selectedMode === "listening" ? "selected" : ""}`}
              onClick={() => pickMode("listening")}
            >
              <span className="mode-icon listen">聽</span>
              <span>
                <b>Listening</b>
                <small>聽力測驗 · Original practice questions</small>
              </span>
              <i>{selectedMode === "listening" ? "✓" : "→"}</i>
            </button>
          </div>
          <div className="level-select">
            <div>
              <span className="eyebrow">CHOOSE A LEVEL</span>
            </div>
            <div className="level-buttons">
              {(["A", "B", "C"] as TocflLevel[]).map((item) => (
                <button
                  key={item}
                  className={level === item ? "active" : ""}
                  onClick={() => pickLevel(item)}
                >
                  <b>{item}</b>
                  <span>{levelDetails[item].label}</span>
                </button>
              ))}
            </div>
          </div>
          <section className="question-type-picker">
            <div className="picker-heading">
              <span className="eyebrow">CHOOSE QUESTION TYPES</span>
            </div>
            <div>
              {availableTypes.map((type) => (
                <label key={type}>
                  <input
                    type="checkbox"
                    checked={activeSelectedTypes.includes(type)}
                    onChange={() => toggleType(type)}
                  />
                  <span>{typeLabels[type]}</span>
                </label>
              ))}
            </div>
          </section>
          <section className="quiz-length-picker">
            <div className="picker-heading">
              <span className="eyebrow">CHOOSE QUIZ LENGTH</span>
              <small>
                Up to {questionPool.length} selected questions are available.
              </small>
            </div>
            <label>
              <span>Questions in this session</span>
              <input
                type="range"
                min="1"
                max={maxQuizLength}
                value={quizLength}
                disabled={!questionPool.length}
                onChange={(event) =>
                  setQuestionCount(Number(event.target.value))
                }
                style={{
                  background: `linear-gradient(to right, var(--pine) 0 ${quizLengthPercentage}%, #dce8e1 ${quizLengthPercentage}% 100%)`,
                }}
              />
              <output>{quizLength}</output>
            </label>
          </section>
          <button
            className="primary-button full-button"
            onClick={begin}
            disabled={!questions.length}
          >
            {questions.length
              ? `Begin ${selectedMode === "listening" ? "Listening" : "Reading"} practice · ${quizLength} questions · ${formatTime(sessionDuration)}`
              : "Select at least one question type"}{" "}
            <span>→</span>
          </button>
        </div>
      </section>
      <section className="how-it-works" id="about">
        <p className="eyebrow">A SIMPLE PRACTICE LOOP</p>
        <div>
          <article>
            <span>01</span>
            <h3>Choose your band</h3>
            <p>Start where your current study needs are.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Choose formats</h3>
            <p>Keep every type, or practise only the formats you want.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Learn from every answer</h3>
            <p>Review concise explanations at the end.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
