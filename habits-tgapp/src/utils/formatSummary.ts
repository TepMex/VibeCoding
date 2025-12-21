interface QuestionAnswer {
  question: string;
  answer: string;
}

interface SummarySection {
  sectionTitle: string;
  questionsAndAnswers: QuestionAnswer[];
}

const sectionEmojis: Record<string, string> = {
  'Цель': '🎯',
  'Контекст': '📍',
  'Протокол': '📋',
  'Доступность': '🚀',
  'Кайф': '✨',
};

export const formatSummaryForTelegram = (habitName: string, summary: SummarySection[]): string => {
  let message = `\n🌟 **${habitName}**\n\n`;
  
  summary.forEach((section, index) => {
    const emoji = sectionEmojis[section.sectionTitle] || '📌';
    message += `${emoji} **${section.sectionTitle}**\n\n`;
    
    section.questionsAndAnswers.forEach((qa) => {
      message += `❓ ${qa.question}\n`;
      message += `💡 ${qa.answer}\n\n`;
    });
    
    if (index < summary.length - 1) {
      message += '---\n\n';
    }
  });
  
  return message;
};


