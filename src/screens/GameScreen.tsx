import { useState, useEffect, useRef, useCallback } from 'react';
import { Container, Box, Typography, Card, CardContent, IconButton, Snackbar, Alert } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import type { MistakenPair, GameCard } from '../types';
import { calculateScore } from '../utils/score';
import { getPairs, getHighscore, setHighscore } from '../utils/pairsStorage';

interface GameScreenProps {
  mode: 'training' | 'survival';
  onSettings: () => void;
  onGameEnd?: () => void;
}

const TRAINING_MAX_SWIPES = 50;

export const GameScreen = ({ mode, onSettings, onGameEnd }: GameScreenProps) => {
  const [pairs, setPairs] = useState<MistakenPair[]>([]);
  const [currentCard, setCurrentCard] = useState<GameCard | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [swipeCount, setSwipeCount] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showHighscoreBanner, setShowHighscoreBanner] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadPairs = () => {
      setPairs(getPairs());
    };
    
    loadPairs();
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'hanzi-mistaken-pairs') {
        loadPairs();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const generateCard = useCallback((): GameCard => {
    if (pairs.length === 0) {
      return {
        hanzi: '',
        pinyin: '',
        isCorrect: false,
      };
    }
    const pair = pairs[Math.floor(Math.random() * pairs.length)];
    const selectFirst = Math.random() < 0.5;
    const isCorrect = Math.random() < 0.5;

    return {
      hanzi: selectFirst ? pair.hanzi1 : pair.hanzi2,
      pinyin: isCorrect
        ? (selectFirst ? pair.pinyin1 : pair.pinyin2)
        : (selectFirst ? pair.pinyin2 : pair.pinyin1),
      isCorrect,
    };
  }, [pairs]);

  useEffect(() => {
    if (pairs.length > 0) {
      setScore(0);
      setStreak(0);
      setSwipeCount(0);
      setGameOver(false);
      setShowHighscoreBanner(false);
      setShowFeedback(false);
      const card = generateCard();
      setCurrentCard(card);
    }
  }, [pairs, generateCard, mode]);

  const handleAnswer = useCallback((answer: boolean) => {
    if (!currentCard || gameOver) return;

    const isCorrect = answer === currentCard.isCorrect;
    
    if (mode === 'training') {
      // Training mode: no score, show feedback on incorrect, limit 50
      if (!isCorrect) {
        // Find the correct pinyin for this hanzi
        const correctPair = pairs.find(
          p => p.hanzi1 === currentCard.hanzi || p.hanzi2 === currentCard.hanzi
        );
        const correctPinyin = correctPair 
          ? (currentCard.hanzi === correctPair.hanzi1 ? correctPair.pinyin1 : correctPair.pinyin2)
          : '';
        setFeedbackMessage(`Incorrect! Correct answer: ${currentCard.hanzi} ${correctPinyin}`);
        setShowFeedback(true);
        setTimeout(() => {
          setShowFeedback(false);
        }, 2000);
      }

      const newSwipeCount = swipeCount + 1;
      setSwipeCount(newSwipeCount);

      if (newSwipeCount >= TRAINING_MAX_SWIPES) {
        setGameOver(true);
        if (onGameEnd) {
          setTimeout(() => {
            onGameEnd();
          }, 2000);
        }
        return;
      }

      const newCard = generateCard();
      setCurrentCard(newCard);
      setSwipeOffset(0);
    } else {
      // Survival mode: score = max streak, game ends on first incorrect
      const { score: newScore, streakContinues } = calculateScore(isCorrect, streak);

      if (!isCorrect) {
        // Game over on first incorrect answer
        setGameOver(true);
        setScore(newScore);
        const currentHighscore = getHighscore();
        if (newScore > currentHighscore) {
          setHighscore(newScore);
          setShowHighscoreBanner(true);
        }
        if (onGameEnd) {
          setTimeout(() => {
            onGameEnd();
          }, 2000);
        }
        return;
      }

      // Correct answer: continue
      const newStreak = streak + 1;
      setStreak(newStreak);
      setScore(newScore);

      const newCard = generateCard();
      setCurrentCard(newCard);
      setSwipeOffset(0);
    }
  }, [currentCard, streak, generateCard, swipeCount, mode, pairs, onGameEnd, gameOver]);

  useEffect(() => {
    if (gameOver) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleAnswer(false);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleAnswer(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleAnswer, gameOver]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    setIsDragging(true);
  };

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || gameOver) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = Math.abs(touch.clientY - touchStartY.current);

    if (Math.abs(deltaX) > deltaY) {
      e.preventDefault();
      setSwipeOffset(deltaX);
    }
  }, [isDragging, gameOver]);

  const handleTouchEnd = () => {
    if (!isDragging) return;

    const threshold = 100;
    if (Math.abs(swipeOffset) > threshold) {
      handleAnswer(swipeOffset > 0);
    } else {
      setSwipeOffset(0);
    }
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    touchStartX.current = e.clientX;
    touchStartY.current = e.clientY;
    setIsDragging(true);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || gameOver) return;

    const deltaX = e.clientX - touchStartX.current;
    const deltaY = Math.abs(e.clientY - touchStartY.current);

    if (Math.abs(deltaX) > deltaY) {
      setSwipeOffset(deltaX);
    }
  }, [isDragging, gameOver]);

  const handleMouseUp = () => {
    if (!isDragging) return;

    const threshold = 100;
    if (Math.abs(swipeOffset) > threshold) {
      handleAnswer(swipeOffset > 0);
    } else {
      setSwipeOffset(0);
    }
    setIsDragging(false);
  };

  if (!currentCard) {
    return null;
  }

  const rotation = gameOver ? 0 : swipeOffset * 0.1;
  const opacity = gameOver ? 1 : (1 - Math.abs(swipeOffset) / 300);

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 2,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {mode === 'survival' && (
            <Typography
              component="div"
              sx={{
                fontWeight: 'bold',
                color: 'primary.main',
                fontSize: '3rem',
                lineHeight: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: { xs: '120px', sm: '200px' },
                '@media (max-width: 600px)': {
                  fontSize: '2rem',
                  maxWidth: '100px',
                },
              }}
            >
              {score}
            </Typography>
          )}
          <IconButton onClick={onSettings}>
            <SettingsIcon />
          </IconButton>
        </Box>
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {mode === 'survival' && streak > 0 && (
            <Typography
              variant="h6"
              component="div"
              sx={{
                fontWeight: 'bold',
                color: 'success.main',
              }}
            >
              🔥 {streak}x
            </Typography>
          )}
          {mode === 'training' && (
            <Typography
              variant="body1"
              component="div"
              sx={{
                color: 'text.secondary',
              }}
            >
              {swipeCount}/{TRAINING_MAX_SWIPES}
            </Typography>
          )}
        </Box>

        <Box
          sx={{
            width: '100%',
            maxWidth: 400,
            position: 'relative',
            touchAction: gameOver ? 'auto' : 'pan-y',
          }}
        >
          <Card
            ref={cardRef}
            onTouchStart={gameOver ? undefined : handleTouchStart}
            onTouchMove={gameOver ? undefined : handleTouchMove}
            onTouchEnd={gameOver ? undefined : handleTouchEnd}
            onMouseDown={gameOver ? undefined : handleMouseDown}
            onMouseMove={gameOver ? undefined : handleMouseMove}
            onMouseUp={gameOver ? undefined : handleMouseUp}
            onMouseLeave={gameOver ? undefined : handleMouseUp}
            sx={{
              transform: gameOver ? 'none' : `translateX(${swipeOffset}px) rotate(${rotation}deg)`,
              opacity: gameOver ? 1 : Math.max(0.3, opacity),
              transition: gameOver || !isDragging ? 'transform 0.3s, opacity 0.3s' : 'none',
              cursor: gameOver ? 'default' : 'grab',
              userSelect: 'none',
              ...(!gameOver && {
                '&:active': {
                  cursor: 'grabbing',
                },
              }),
            }}
          >
            <CardContent
              sx={{
                textAlign: 'center',
                padding: 4,
                minHeight: 300,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Typography variant="h2" component="div" sx={{ mb: 3, fontSize: { xs: '3rem', sm: '4rem' } }}>
                {currentCard.hanzi}
              </Typography>
              <Typography variant="h4" component="div" sx={{ color: 'text.secondary' }}>
                {currentCard.pinyin}
              </Typography>
              {gameOver ? (
                <Typography variant="h5" sx={{ mt: 4, color: 'primary.main', fontWeight: 'bold' }}>
                  {mode === 'survival' 
                    ? `Game Over! Final Score: ${score}`
                    : `Training Complete! ${swipeCount} cards reviewed`
                  }
                </Typography>
              ) : (
                <Typography variant="body2" sx={{ mt: 4, color: 'text.disabled' }}>
                  Swipe right if correct, left if incorrect
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>
        <Snackbar
          open={showHighscoreBanner}
          autoHideDuration={3000}
          onClose={() => setShowHighscoreBanner(false)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="success" sx={{ fontSize: '1.2rem', padding: 2 }}>
            🎉 New Highscore: {score}!
          </Alert>
        </Snackbar>
        <Snackbar
          open={showFeedback}
          autoHideDuration={2000}
          onClose={() => setShowFeedback(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity="error" sx={{ fontSize: '1rem', padding: 2 }}>
            {feedbackMessage}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};
