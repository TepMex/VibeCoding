import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  Paper,
  LinearProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { questionnaireTemplate } from '../data/questionnaireTemplate';
import { useHabits } from '../contexts/HabitsContext';

export default function Questionnaire() {
  const { habitId } = useParams();
  const navigate = useNavigate();
  const { getHabit, updateHabit } = useHabits();
  const habit = getHabit(habitId!);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(habit?.answers || {});

  useEffect(() => {
    if (!habit) {
      navigate('/');
    }
  }, [habit, navigate]);

  const currentSection = questionnaireTemplate.sections[currentSectionIndex];
  const totalSections = questionnaireTemplate.sections.length;
  const progress = ((currentSectionIndex + 1) / totalSections) * 100;
  const isLastSection = currentSectionIndex === totalSections - 1;
  const isCompleted = currentSectionIndex >= totalSections;

  const getAnswer = (questionId: string): string => {
    return answers[questionId] || '';
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    if (habitId) {
      updateHabit(habitId, { answers: newAnswers });
    }
  };

  const handleNext = () => {
    if (isLastSection) {
      setCurrentSectionIndex(totalSections);
    } else {
      setCurrentSectionIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex((prev) => prev - 1);
    } else {
      navigate('/');
    }
  };

  const getSummary = () => {
    return questionnaireTemplate.sections.map((section) => ({
      sectionTitle: section.title,
      questionsAndAnswers: section.questions.map((q) => ({
        question: q.text,
        answer: getAnswer(q.id) || 'Не указано',
      })),
    }));
  };

  if (!habit) {
    return null;
  }

  if (isCompleted) {
    const summary = getSummary();
    return (
      <Container maxWidth="sm">
        <Box sx={{ py: 4 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/')}
            sx={{ mb: 2 }}
          >
            К списку привычек
          </Button>

          <Typography variant="h4" component="h1" gutterBottom>
            {habit.name}
          </Typography>

          <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
            Резюме
          </Typography>

          {summary.map((section, idx) => (
            <Paper key={idx} sx={{ p: 3, mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                {section.sectionTitle}
              </Typography>
              {section.questionsAndAnswers.map((qa, qIdx) => (
                <Box key={qIdx} sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {qa.question}
                  </Typography>
                  <Typography variant="body1">{qa.answer}</Typography>
                </Box>
              ))}
            </Paper>
          ))}

          <Button
            variant="contained"
            onClick={() => setCurrentSectionIndex(0)}
            fullWidth
          >
            Редактировать
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{ mb: 2 }}
        >
          Назад
        </Button>

        <Box sx={{ mb: 3 }}>
          <Typography variant="overline" color="text.secondary">
            Раздел {currentSectionIndex + 1} из {totalSections}
          </Typography>
          <LinearProgress variant="determinate" value={progress} sx={{ my: 1 }} />
        </Box>

        <Typography variant="h6" color="text.secondary" gutterBottom>
          {habit.name}
        </Typography>

        <Typography variant="h4" component="h1" gutterBottom>
          {currentSection.title}
        </Typography>

        <Box component="form" sx={{ mt: 3 }}>
          {currentSection.questions.map((question, idx) => (
            <Box key={question.id} sx={{ mb: 3 }}>
              <Typography variant="body1" gutterBottom>
                {idx + 1}. {question.text}
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={getAnswer(question.id)}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                placeholder="Ваш ответ..."
                variant="outlined"
              />
            </Box>
          ))}

          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={handleNext}
            endIcon={<ArrowForwardIcon />}
          >
            {isLastSection ? 'Завершить' : 'Далее'}
          </Button>
        </Box>
      </Box>
    </Container>
  );
}
