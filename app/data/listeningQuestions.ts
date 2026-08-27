import type { Question } from "./questions";
import sourceQuestions from "./listeningQuestions.json";

// This file is deliberately JSON-backed: the same source drives the local
// neural-TTS generator in scripts/generate-listening-audio.mjs.
export const listeningQuestions = sourceQuestions as Question[];
