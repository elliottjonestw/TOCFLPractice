"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  levelDetails,
  readingGroups,
  readingQuestions,
  type Question,
  type QuestionType,
  type TocflLevel,
  type Visual,
} from "./data/questions";

type Answer = string | Record<string, string>;

const typeLabels: Record<QuestionType, string> = {
  "single-choice": "Single choice",
  cloze: "Single blank",
  "reading-comprehension": "Reading comprehension",
  "image-choice": "Sentence → image",
  "picture-description": "Image → sentence",
  "picture-cloze": "Picture cloze",
  "word-bank-cloze": "Shared word bank",
  "sentence-insertion": "Sentence insertion",
};

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
const readingSecondsPerQuestion = 72;
const typesForLevel = (level: TocflLevel) =>
  Array.from(
    new Set(
      readingQuestions
        .filter((item) => item.level === level && item.mode === "reading")
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

function VisualStimulus({ visual }: { visual: Visual }) {
  if (visual.kind === "image")
    return (
      <figure className="visual-stimulus image-stimulus">
        <img src={visual.src} alt={visual.alt} />
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

export default function Home() {
  const [screen, setScreen] = useState<"welcome" | "exam" | "results">(
    "welcome",
  );
  const [level, setLevel] = useState<TocflLevel>("A");
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>(() =>
    typesForLevel("A"),
  );
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [activeBlank, setActiveBlank] = useState("");
  const [seconds, setSeconds] = useState(10 * readingSecondsPerQuestion);
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);
  const [questionCount, setQuestionCount] = useState(10);
  const availableTypes = useMemo(() => typesForLevel(level), [level]);
  const questionPool = useMemo(
    () =>
      readingQuestions.filter(
        (item) =>
          item.level === level &&
          item.mode === "reading" &&
          selectedTypes.includes(item.type),
      ),
    [level, selectedTypes],
  );
  const questions = screen === "welcome" ? questionPool : sessionQuestions;
  const maxQuizLength = Math.max(questionPool.length, 1);
  const quizLength = Math.min(Math.max(questionCount, 1), maxQuizLength);
  const quizLengthPercentage =
    maxQuizLength > 1 ? ((quizLength - 1) / (maxQuizLength - 1)) * 100 : 100;
  const sessionDuration = quizLength * readingSecondsPerQuestion;
  const question = questions[index];
  const questionBankNumber = question
    ? readingQuestions
        .filter(
          (item) =>
            item.level === question.level && item.mode === question.mode,
        )
        .findIndex((item) => item.id === question.id) + 1
    : 0;
  const group = readingGroups.find((item) => item.id === question?.groupId);
  const passage = question?.passage || group?.passage;
  const visual = question?.visual || group?.visual;
  const answer = question ? answers[question.id] : undefined;
  const answered = questions.filter((item) =>
    isComplete(item, answers[item.id]),
  ).length;

  useEffect(() => {
    if (screen !== "exam") return;
    const timer = window.setInterval(
      () => setSeconds((value) => Math.max(value - 1, 0)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [screen]);

  useLayoutEffect(() => {
    const savedLevel = window.localStorage.getItem(
      "tocfl-practice:last-reading-level",
    );
    if (savedLevel !== "A" && savedLevel !== "B" && savedLevel !== "C") return;
    setLevel(savedLevel);
    setSelectedTypes(typesForLevel(savedLevel));
  }, []);

  useEffect(() => {
    if (question?.blanks?.length) setActiveBlank(question.blanks[0]);
    else setActiveBlank("");
  }, [question?.id]);

  useEffect(() => {
    setQuestionCount((current) =>
      Math.min(Math.max(current, 1), Math.max(questionPool.length, 1)),
    );
  }, [questionPool.length]);

  function begin() {
    if (!questionPool.length) return;
    setAnswers({});
    setIndex(0);
    setSeconds(sessionDuration);
    setSessionQuestions(shuffleQuestions(questionPool).slice(0, quizLength));
    setScreen("exam");
  }

  function pickLevel(next: TocflLevel) {
    setLevel(next);
    setSelectedTypes(typesForLevel(next));
    window.localStorage.setItem("tocfl-practice:last-reading-level", next);
    setIndex(0);
  }

  function toggleType(type: QuestionType) {
    setSelectedTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    );
    setIndex(0);
  }

  function choose(optionId: string) {
    if (!question) return;
    if (question.type === "word-bank-cloze") {
      setAnswers((current) => ({
        ...current,
        [question.id]: {
          ...(typeof current[question.id] === "string"
            ? {}
            : current[question.id]),
          [activeBlank]: optionId,
        },
      }));
    } else {
      setAnswers((current) => ({ ...current, [question.id]: optionId }));
    }
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
    const correct = questions.filter((item) =>
      isCorrect(item, answers[item.id]),
    ).length;
    const scorePercentage = questions.length
      ? (correct / questions.length) * 100
      : 0;
    return (
      <main className="app-shell result-shell">
        <header className="brand-header">
          <button className="brand" onClick={() => setScreen("welcome")}>
            <span className="brand-mark">華</span>
            <span>
              TOCFL
              <br />
              <em>Practice</em>
            </span>
          </button>
          <span className="mode-pill">READING</span>
        </header>
        <section className="result-card">
          <p className="eyebrow">PRACTICE COMPLETE</p>
          <h1>{levelDetails[level].name} Reading</h1>
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
            Your answers are ready to review. Explanations are shown below each
            question.
          </p>
          <div className="review-list">
            {questions.map((item, itemIndex) => (
              <article
                key={item.id}
                className={`review-item ${isCorrect(item, answers[item.id]) ? "correct" : "incorrect"}`}
              >
                <span>{itemIndex + 1}</span>
                <div>
                  <b>
                    {isCorrect(item, answers[item.id])
                      ? "Correct"
                      : "Review this one"}
                  </b>
                  <p>{item.explanation}</p>
                </div>
              </article>
            ))}
          </div>
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
    const usedOptions =
      question.type === "word-bank-cloze" && typeof answer !== "string"
        ? Object.values(answer || {})
        : [];
    return (
      <main className="exam-shell">
        <header className="exam-header">
          <button
            className="brand brand-small"
            onClick={() => setScreen("welcome")}
          >
            <span className="brand-mark">華</span>
            <span>
              TOCFL
              <br />
              <em>Practice</em>
            </span>
          </button>
          <div className="exam-title">
            <b>Reading Practice</b>
            <span>
              {levelDetails[level].name} · {levelDetails[level].label}
            </span>
          </div>
          <div className="timer">
            <span>◷</span> {formatTime(seconds)}
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
            <div className="number-grid">
              {questions.map((item, itemIndex) => (
                <button
                  key={item.id}
                  onClick={() => setIndex(itemIndex)}
                  className={`${index === itemIndex ? "active" : ""} ${isComplete(item, answers[item.id]) ? "answered" : ""}`}
                >
                  {itemIndex + 1}
                </button>
              ))}
            </div>
            <div className="nav-key">
              <i className="key-current" /> Current{" "}
              <i className="key-answered" /> Answered
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
            <h1>{question.prompt}</h1>
            {question.type === "word-bank-cloze" && (
              <p className="blank-helper">
                Choose a blank in the passage, then choose one unused answer.
              </p>
            )}
            <div
              className={`answer-list ${question.type === "image-choice" ? "image-answer-list" : ""}`}
              role="radiogroup"
              aria-label="Answer options"
            >
              {question.options.map((option) => {
                const selected =
                  question.type === "word-bank-cloze" &&
                  typeof answer !== "string"
                    ? answer?.[activeBlank] === option.id
                    : answer === option.id;
                const unavailable =
                  question.type === "word-bank-cloze" &&
                  usedOptions.includes(option.id) &&
                  !selected;
                return (
                  <button
                    key={option.id}
                    onClick={() => choose(option.id)}
                    disabled={unavailable}
                    className={selected ? "selected" : ""}
                    role="radio"
                    aria-checked={selected}
                  >
                    <span>{option.id}</span>
                    {option.visual && <VisualStimulus visual={option.visual} />}
                    <b>{option.visual ? option.text : null}</b>
                    {!option.visual && option.text}
                  </button>
                );
              })}
            </div>
            <footer className="question-footer">
              <button
                className="secondary-button"
                disabled={index === 0}
                onClick={() => setIndex((value) => value - 1)}
              >
                ← Previous
              </button>
              {index === questions.length - 1 ? (
                <button
                  className="primary-button"
                  onClick={() => setScreen("results")}
                >
                  Finish practice <span>→</span>
                </button>
              ) : (
                <button
                  className="primary-button"
                  onClick={() => setIndex((value) => value + 1)}
                >
                  Next question <span>→</span>
                </button>
              )}
            </footer>
          </section>
          <aside className="exam-summary">
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
            day. Start with Reading; Listening is on its way.
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
            <button className="mode-option selected">
              <span className="mode-icon">文</span>
              <span>
                <b>Reading</b>
                <small>閱讀測驗 · Available now</small>
              </span>
              <i>✓</i>
            </button>
            <button className="mode-option disabled" disabled>
              <span className="mode-icon listen">◖</span>
              <span>
                <b>Listening</b>
                <small>聽力測驗 · Coming soon</small>
              </span>
              <i>→</i>
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
                    checked={selectedTypes.includes(type)}
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
              ? `Begin Reading practice · ${quizLength} questions · ${formatTime(sessionDuration)}`
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
