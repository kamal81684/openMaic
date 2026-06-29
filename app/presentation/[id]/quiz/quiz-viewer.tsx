"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { QuizResponse } from "../../../../lib/quiz";

type Props = {
  deckId: string;
  topic: string;
};

type QuizAnswers = Record<number, string>;

export default function QuizViewer({ deckId, topic }: Props) {
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function loadQuiz() {
      try {
        const response = await fetch(`/api/decks/${deckId}/quiz`);
        if (!response.ok) {
          throw new Error(`Failed to load quiz (${response.status})`);
        }

        const data = await response.json();
        if (data.quiz?.questions?.length > 0) {
          setQuiz(data.quiz);
          setStatus("ready");
        } else {
          setStatus("empty");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load quiz");
        setStatus("error");
      }
    }

    loadQuiz();
  }, [deckId]);

  async function handleGenerateQuiz() {
    setIsGenerating(true);
    setError(null);
    setSubmitted(false);
    setAnswers({});

    try {
      const response = await fetch(`/api/decks/${deckId}/quiz`, { method: "POST" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Quiz generation failed (${response.status})`);
      }

      const data = await response.json();
      setQuiz(data);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate quiz");
      setStatus("error");
    } finally {
      setIsGenerating(false);
    }
  }

  const score = useMemo(() => {
    if (!quiz || !submitted) return 0;
    return quiz.questions.reduce((total, question, index) => {
      return total + (answers[index] === question.correctLabel ? 1 : 0);
    }, 0);
  }, [answers, quiz, submitted]);

  function handleSubmit() {
    if (!quiz) return;
    setSubmitted(true);
  }

  function handleReset() {
    setSubmitted(false);
    setAnswers({});
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-300/80">Quiz</p>
            <h1 className="mt-2 text-2xl font-bold">{quiz?.topic || topic}</h1>
            <p className="mt-1 text-sm text-slate-400">Answer all 10 questions, then submit to see your score out of 10.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/presentation/${deckId}`)}
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
            >
              Back to Presentation
            </button>
            <button
              type="button"
              onClick={handleGenerateQuiz}
              disabled={isGenerating}
              className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-2 text-sm font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/20 disabled:opacity-60"
            >
              {isGenerating ? "Generating..." : quiz ? "Regenerate Quiz" : "Generate Quiz"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        {status === "loading" && (
          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-10 text-slate-300">
            Loading quiz...
          </div>
        )}

        {status === "error" && (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-6 py-10">
            <p className="text-red-200">{error || "Failed to load quiz."}</p>
            <button
              type="button"
              onClick={handleGenerateQuiz}
              className="mt-4 rounded-full border border-red-500/30 px-4 py-2 text-sm text-red-100 transition hover:bg-red-500/10"
            >
              Try Again
            </button>
          </div>
        )}

        {status === "empty" && (
          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-10">
            <p className="text-slate-300">No quiz has been generated yet for this topic.</p>
            <button
              type="button"
              onClick={handleGenerateQuiz}
              className="mt-4 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-2 text-sm font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/20"
            >
              Generate Quiz
            </button>
          </div>
        )}

        {quiz?.questions?.length ? (
          <>
            {submitted ? (
              <div className="mb-8 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 px-6 py-5">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-200">Score</p>
                <p className="mt-2 text-4xl font-bold text-white">
                  {score} / 10
                </p>
                <p className="mt-2 text-sm text-emerald-100/80">
                  Here are the correct answers for review.
                </p>
              </div>
            ) : (
              <div className="mb-8 rounded-3xl border border-white/10 bg-white/5 px-6 py-5">
                <p className="text-sm text-slate-300">
                  Select one option for each question and click Submit Quiz when you&apos;re done.
                </p>
              </div>
            )}

            <section className="grid gap-5 md:grid-cols-2">
              {quiz.questions.map((item, index) => {
                const selected = answers[index];
                const isCorrect = submitted && selected === item.correctLabel;
                const selectedOption = item.options.find((option) => option.label === selected);
                const correctOption = item.options.find((option) => option.label === item.correctLabel);

                return (
                  <article key={`${item.question}-${index}`} className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Question {index + 1}</p>
                        <h2 className="mt-2 text-xl font-semibold text-white">{item.question}</h2>
                      </div>
                      {submitted ? (
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isCorrect ? "bg-emerald-500/15 text-emerald-200" : "bg-red-500/15 text-red-200"}`}>
                          {isCorrect ? "Correct" : "Incorrect"}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-5 space-y-3">
                      {item.options.map((option) => {
                        const isSelected = selected === option.label;
                        const isRightAnswer = submitted && option.label === item.correctLabel;
                        const isWrongSelected = submitted && isSelected && option.label !== item.correctLabel;

                        return (
                          <button
                            key={option.label}
                            type="button"
                            disabled={submitted}
                            onClick={() => setAnswers((prev) => ({ ...prev, [index]: option.label }))}
                            className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                              isRightAnswer
                                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                                : isWrongSelected
                                ? "border-red-400/30 bg-red-500/10 text-red-100"
                                : isSelected
                                ? "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100"
                                : "border-white/10 bg-slate-950/60 text-slate-300 hover:bg-white/10"
                            } ${submitted ? "cursor-default" : "cursor-pointer"}`}
                          >
                            <span className="mr-2 font-semibold">{option.label}.</span>
                            {option.text}
                          </button>
                        );
                      })}
                    </div>

                    {submitted ? (
                      <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-sm text-slate-200">
                        <p className="font-semibold text-cyan-200">Correct Answer: {item.correctLabel}</p>
                        {correctOption ? <p className="mt-1 text-slate-300">{correctOption.text}</p> : null}
                        <p className="mt-2 text-slate-300">{item.explanation}</p>
                        <p className="mt-3 text-xs text-slate-400">
                          Your answer: {selectedOption ? `${selectedOption.label}. ${selectedOption.text}` : "Not answered"}
                        </p>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </section>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {!submitted ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:from-cyan-400 hover:to-blue-400"
                >
                  Submit Quiz
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-full border border-white/15 px-5 py-3 text-sm text-slate-200 transition hover:bg-white/10"
                >
                  Change Answers
                </button>
              )}
              <span className="text-sm text-slate-400">
                Score is shown after submission and counts out of 10.
              </span>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
