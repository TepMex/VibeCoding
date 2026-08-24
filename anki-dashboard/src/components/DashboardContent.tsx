import {
  AccessTimeRounded,
  AutoStoriesRounded,
  ErrorOutlineRounded,
  PsychologyRounded,
  ScheduleRounded,
  SpeedRounded,
} from '@mui/icons-material'
import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
  useTheme,
} from '@mui/material'
import { useMemo, useState, type ReactNode } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DashboardData, DayCount } from '../types'
import { IPlusOneContent } from './IPlusOneContent'

interface Props {
  data: DashboardData
  selectedDecks: string[]
}

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode
  label: string
  value: string
  detail: string
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Box>
            <Typography color="text.secondary" variant="body2">
              {label}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 750 }}>
              {value}
            </Typography>
            <Typography color="text.secondary" variant="caption">
              {detail}
            </Typography>
          </Box>
          <Box color="primary.main" aria-hidden>
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {subtitle}
        </Typography>
        {children}
      </CardContent>
    </Card>
  )
}

function chartRows(data: DashboardData) {
  const mistakeMap = new Map(data.mistakes)
  const reviewMap = new Map(data.reviews)
  return data.wordsLearned.map(([date, words]) => ({
    date,
    words,
    mistakes: mistakeMap.get(date) ?? 0,
    reviews: reviewMap.get(date) ?? 0,
  }))
}

function Heatmap({
  data,
  color,
  emptyText,
}: {
  data: DayCount[]
  color: string
  emptyText: string
}) {
  const maximum = Math.max(1, ...data.map(([, count]) => count))
  return (
    <Box
      role="img"
      aria-label={emptyText}
      sx={{
        display: 'grid',
        gridAutoFlow: 'column',
        gridTemplateRows: 'repeat(7, 12px)',
        gridAutoColumns: '12px',
        gap: '3px',
        overflowX: 'auto',
        pb: 1,
      }}
    >
      {data.map(([date, count]) => (
        <Box
          component="span"
          key={date}
          title={`${date}: ${count}`}
          sx={{
            borderRadius: '3px',
            bgcolor: count ? color : 'action.hover',
            opacity: count ? 0.22 + 0.78 * (count / maximum) : 1,
          }}
        />
      ))}
    </Box>
  )
}

function stripHtml(value: string) {
  const element = document.createElement('div')
  element.innerHTML = value
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function Leeches({
  data,
  selectedDecks,
}: {
  data: DashboardData
  selectedDecks: string[]
}) {
  const [fields, setFields] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('anki-dashboard.leech-fields') ?? '{}')
    } catch {
      return {}
    }
  })

  const effectiveFields = useMemo(
    () =>
      Object.fromEntries(
        selectedDecks.map((deck) => {
          const options = data.fieldOptions[deck] ?? []
          return [
            deck,
            options.includes(fields[deck]) ? fields[deck] : (options[0] ?? ''),
          ]
        }),
      ),
    [data.fieldOptions, fields, selectedDecks],
  )

  return (
    <ChartCard
      title="Leeches"
      subtitle="Cards tagged as leeches, ordered by review count"
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ gap: 1.5, mb: 2 }}
      >
        {selectedDecks.map((deck) => {
          const options = data.fieldOptions[deck] ?? []
          return (
            <FormControl size="small" key={deck} sx={{ minWidth: 180 }}>
              <InputLabel>{deck}</InputLabel>
              <Select
                label={deck}
                value={effectiveFields[deck] ?? ''}
                onChange={(event) => {
                  const next = { ...fields, [deck]: event.target.value }
                  setFields(next)
                  localStorage.setItem(
                    'anki-dashboard.leech-fields',
                    JSON.stringify(next),
                  )
                }}
              >
                {options.map((field) => (
                  <MenuItem value={field} key={field}>
                    {field}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )
        })}
      </Stack>
      {data.leeches.length === 0 ? (
        <Typography color="text.secondary">No leeches in selected decks.</Typography>
      ) : (
        <Stack sx={{ gap: 1 }}>
          {data.leeches.map((card) => {
            const field = effectiveFields[card.deckName]
            const text = stripHtml(card.fields[field] ?? '') || 'Untitled card'
            return (
              <Box
                key={card.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography noWrap title={text}>
                    {text}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {card.deckName}
                  </Typography>
                </Box>
                <Chip label={`${card.reviewCount} reviews`} size="small" />
              </Box>
            )
          })}
        </Stack>
      )}
    </ChartCard>
  )
}

export function DashboardContent({ data, selectedDecks }: Props) {
  const theme = useTheme()
  const [activeTab, setActiveTab] = useState(0)
  const progress = data.totalCards
    ? (data.memorized / data.totalCards) * 100
    : 0
  const history = useMemo(() => chartRows(data), [data])
  const monthly = data.newVocabulary.map(([month, count]) => ({ month, count }))
  const debt = data.debtHistory.map(([date, count]) => ({ date, count }))

  return (
    <Stack sx={{ gap: 2.5 }}>
      <Card variant="outlined">
        <Tabs
          value={activeTab}
          onChange={(_, value: number) => setActiveTab(value)}
          variant="fullWidth"
          aria-label="Dashboard sections"
        >
          <Tab label="Dashboard" />
          <Tab label={`i + 1 (${data.iPlusOneWords.length})`} />
        </Tabs>
      </Card>

      {activeTab === 0 ? (
        <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(5, minmax(0, 1fr))',
          },
          gap: 1.5,
        }}
      >
        <StatCard
          icon={<SpeedRounded />}
          label="7-day pace"
          value={`${data.reviewScore.toFixed(1)}s`}
          detail="per review"
        />
        <StatCard
          icon={<AutoStoriesRounded />}
          label="Memorized"
          value={`${data.memorized.toLocaleString()}`}
          detail={`of ${data.totalCards.toLocaleString()} cards`}
        />
        <StatCard
          icon={<AccessTimeRounded />}
          label="Study time"
          value={`${data.totalHours.toFixed(1)}h`}
          detail="all reviews"
        />
        <StatCard
          icon={<PsychologyRounded />}
          label="Long memory"
          value={data.longMemory.toLocaleString()}
          detail="interval over 360 days"
        />
        <StatCard
          icon={<ScheduleRounded />}
          label="Review debt"
          value={data.debt.toLocaleString()}
          detail="due now"
        />
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Stack
            direction="row"
            sx={{ justifyContent: 'space-between', mb: 1 }}
          >
            <Typography sx={{ fontWeight: 700 }}>Vocabulary retained</Typography>
            <Typography color="primary.main" sx={{ fontWeight: 750 }}>
              {progress.toFixed(1)}%
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={Math.min(progress, 100)}
            sx={{ height: 10, borderRadius: 5 }}
          />
        </CardContent>
      </Card>

      <ChartCard
        title="Vocabulary learning progress"
        subtitle="Cumulative new cards, reviews and mistakes over two years"
      >
        <Box sx={{ height: { xs: 300, md: 380 } }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={history}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                minTickGap={48}
                tickFormatter={(value) => String(value).slice(0, 7)}
              />
              <YAxis yAxisId="words" width={48} />
              <YAxis yAxisId="activity" orientation="right" width={42} />
              <Tooltip />
              <Area
                yAxisId="words"
                dataKey="words"
                name="Words learned"
                stroke={theme.palette.primary.main}
                fill={theme.palette.primary.main}
                fillOpacity={0.12}
                strokeWidth={2.5}
                dot={false}
              />
              <Bar
                yAxisId="activity"
                dataKey="reviews"
                name="Reviews"
                fill={theme.palette.info.main}
                opacity={0.45}
              />
              <Bar
                yAxisId="activity"
                dataKey="mistakes"
                name="Mistakes"
                fill={theme.palette.error.main}
                opacity={0.7}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Box>
      </ChartCard>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          gap: 2.5,
        }}
      >
        <ChartCard title="Review intensity" subtitle="Daily reviews in the last year">
          <Heatmap
            data={data.reviewHeatmap}
            color={theme.palette.primary.main}
            emptyText="Review activity calendar"
          />
        </ChartCard>
        <ChartCard title="Review hardness" subtitle="Again answers in the last year">
          <Heatmap
            data={data.mistakeHeatmap}
            color={theme.palette.error.main}
            emptyText="Mistake activity calendar"
          />
        </ChartCard>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          gap: 2.5,
        }}
      >
        <ChartCard title="Review debt" subtitle="Reconstructed from review history">
          <Box sx={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={debt}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  minTickGap={44}
                  tickFormatter={(value) => String(value).slice(5)}
                />
                <YAxis width={45} />
                <Tooltip />
                <Line
                  dataKey="count"
                  name="Overdue cards"
                  stroke={theme.palette.warning.main}
                  strokeWidth={2.5}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
        </ChartCard>
        <ChartCard title="New vocabulary" subtitle="First reviews grouped by month">
          <Box sx={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" minTickGap={32} />
                <YAxis width={45} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  name="New cards"
                  fill={theme.palette.secondary.main}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </ChartCard>
      </Box>

      {data.totalCards === 0 && (
        <Stack
          direction="row"
          sx={{ gap: 1, color: 'warning.main' }}
        >
          <ErrorOutlineRounded />
          <Typography>No cards found in the selected decks.</Typography>
        </Stack>
      )}

      <Leeches data={data} selectedDecks={selectedDecks} />
        </>
      ) : (
        <IPlusOneContent data={data} />
      )}
    </Stack>
  )
}
