import { useState, useEffect, useRef, useCallback } from 'react';
import { Container, Box, Typography, Card, CardContent } from '@mui/material';
import pairsData from '../assets/pairs.json';
import type { MistakenPair, GameCard } from '../types';
import { calculateScore } from '../utils/score';

export const GameScreen = () => {
  const [pairs] = useState<MistakenPair[]>(pairsData as MistakenPair[]);
  const [currentCard, setCurrentCard] = useState<GameCard | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [cardStartTime, setCardStartTime] = useState<number>(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const generateCard = useCallback((): GameCard => {
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
    const card = generateCard();
    setCurrentCard(card);
    setCardStartTime(Date.now());
  }, [generateCard]);

  const handleAnswer = useCallback((answer: boolean) => {
    if (!currentCard) return;

    const timeToAnswer = Date.now() - cardStartTime;
    const isCorrect = answer === currentCard.isCorrect;
    
    const { score: pointsEarned, streakContinues } = calculateScore(
      isCorrect,
      timeToAnswer,
      streak
    );

    setScore((prev) => prev + pointsEarned);
    setStreak(streakContinues ? streak + 1 : 0);

    const newCard = generateCard();
    setCurrentCard(newCard);
    setCardStartTime(Date.now());
    setSwipeOffset(0);
  }, [currentCard, cardStartTime, streak, generateCard]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = Math.abs(touch.clientY - touchStartY.current);

    if (Math.abs(deltaX) > deltaY) {
      e.preventDefault();
      setSwipeOffset(deltaX);
    }
  };

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

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - touchStartX.current;
    const deltaY = Math.abs(e.clientY - touchStartY.current);

    if (Math.abs(deltaX) > deltaY) {
      setSwipeOffset(deltaX);
    }
  };

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

  const rotation = swipeOffset * 0.1;
  const opacity = 1 - Math.abs(swipeOffset) / 300;

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
        <Typography
          variant="h2"
          component="div"
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            fontWeight: 'bold',
            color: 'primary.main',
          }}
        >
          {score}
        </Typography>
        {streak > 0 && (
          <Typography
            variant="h6"
            component="div"
            sx={{
              position: 'absolute',
              top: 16,
              left: 16,
              fontWeight: 'bold',
              color: 'success.main',
            }}
          >
            🔥 {streak}x
          </Typography>
        )}

        <Box
          sx={{
            width: '100%',
            maxWidth: 400,
            position: 'relative',
            touchAction: 'pan-y',
          }}
        >
          <Card
            ref={cardRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            sx={{
              transform: `translateX(${swipeOffset}px) rotate(${rotation}deg)`,
              opacity: Math.max(0.3, opacity),
              transition: isDragging ? 'none' : 'transform 0.3s, opacity 0.3s',
              cursor: 'grab',
              userSelect: 'none',
              '&:active': {
                cursor: 'grabbing',
              },
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
              <Typography variant="body2" sx={{ mt: 4, color: 'text.disabled' }}>
                Swipe right if correct, left if incorrect
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Container>
  );
};
