export interface Question {
  id: string;
  text: string;
}

export interface Section {
  id: string;
  title: string;
  questions: Question[];
}

export interface Answer {
  questionId: string;
  value: string;
}

export interface QuestionnaireData {
  sections: Section[];
}
