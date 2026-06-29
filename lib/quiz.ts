export type QuizOption = {
  label: string;
  text: string;
};

export type QuizQuestion = {
  question: string;
  options: QuizOption[];
  correctLabel: string;
  explanation: string;
};

export type QuizResponse = {
  topic: string;
  questions: QuizQuestion[];
};

