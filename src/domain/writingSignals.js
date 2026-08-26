const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const AI_PHRASES = [
  "in today's rapidly evolving", "it is important to note", "in conclusion", "delve into",
  "unlock the potential", "ever-evolving landscape", "game-changer", "seamlessly",
  "moreover", "furthermore", "comprehensive guide", "let's explore",
];

const HUMAN_MARKERS = ["i ", "i'm", "i’ve", "we ", "we're", "my ", "honestly", "but ", "because ", "here’s"];

export function scoreWritingSignals(input) {
  const text = String(input || "").replace(/\s+/g, " ").trim();
  const words = text.toLowerCase().match(/[a-z0-9']+/g) || [];
  const sentences = text.split(/[.!?]+/).map(item => item.trim()).filter(Boolean);
  const uniqueWords = new Set(words);
  const sentenceLengths = sentences.map(sentence => (sentence.match(/[a-z0-9']+/gi) || []).length).filter(Boolean);
  const averageSentenceLength = sentenceLengths.length ? sentenceLengths.reduce((sum, value) => sum + value, 0) / sentenceLengths.length : 0;
  const variance = sentenceLengths.length > 1
    ? sentenceLengths.reduce((sum, value) => sum + (value - averageSentenceLength) ** 2, 0) / sentenceLengths.length
    : 0;
  const lower = ` ${text.toLowerCase()} `;
  const aiPhraseHits = AI_PHRASES.filter(phrase => lower.includes(phrase)).length;
  const humanMarkerHits = HUMAN_MARKERS.filter(marker => lower.includes(marker)).length;
  const lexicalDiversity = words.length ? uniqueWords.size / words.length : 0;
  const punctuationVariety = [/[?]/, /[!]/, /[—–]/, /[:;]/, /\([^)]{2,}\)/].filter(pattern => pattern.test(text)).length;
  const repeatedOpenings = (() => {
    const openings = sentences.map(sentence => sentence.toLowerCase().match(/[a-z0-9']+/)?.[0]).filter(Boolean);
    return openings.length - new Set(openings).size;
  })();

  let aiEvidence = 0;
  let humanEvidence = 0;
  const signals = [];

  if (aiPhraseHits) { aiEvidence += Math.min(24, aiPhraseHits * 7); signals.push(`${aiPhraseHits} formulaic transition${aiPhraseHits === 1 ? "" : "s"}`); }
  if (sentenceLengths.length >= 4 && variance < 18) { aiEvidence += 11; signals.push("very uniform sentence rhythm"); }
  if (words.length > 120 && lexicalDiversity < 0.42) { aiEvidence += 9; signals.push("repetitive vocabulary pattern"); }
  if (repeatedOpenings >= 3) { aiEvidence += 8; signals.push("repeated sentence openings"); }

  if (humanMarkerHits) { humanEvidence += Math.min(22, humanMarkerHits * 4); signals.push("first-person or conversational markers"); }
  if (sentenceLengths.length >= 4 && variance > 55) { humanEvidence += 12; signals.push("varied sentence rhythm"); }
  if (punctuationVariety >= 3) { humanEvidence += 8; signals.push("varied punctuation and cadence"); }
  if (/\b\d+(?:\.\d+)?%?\b/.test(text)) { humanEvidence += 5; signals.push("concrete numeric detail"); }
  if (/\b(?:yesterday|today|last week|when i|in my|we shipped|i learned)\b/i.test(text)) { humanEvidence += 9; signals.push("specific lived-context language"); }

  const adjustment = clamp(aiEvidence - humanEvidence, -42, 42);
  const aiScore = text ? clamp(Math.round(50 + adjustment), 5, 95) : 0;
  const humanScore = text ? 100 - aiScore : 0;
  const confidence = words.length >= 250 ? "medium" : words.length >= 80 ? "low" : "very low";
  const confidencePercent = words.length >= 250 ? 68 : words.length >= 80 ? 48 : words.length ? 28 : 0;

  return {
    aiScore,
    humanScore,
    confidence,
    confidencePercent,
    wordCount: words.length,
    method: "StackedIN linguistic signals v1",
    signals: signals.slice(0, 5),
    disclaimer: "A writing signal is not proof of authorship. Editing, translation, templates, and short text can change the result.",
  };
}

