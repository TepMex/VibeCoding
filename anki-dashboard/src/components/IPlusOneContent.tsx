import {
  AutoAwesomeRounded,
  OpenInNewRounded,
  SearchRounded,
  TranslateRounded,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  FormControl,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Pagination,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import type { DashboardData } from '../types'

const PAGE_SIZE = 60

function plecoUrl(word: string) {
  return `plecoapi://x-callback-url/s?q=${encodeURIComponent(word)}`
}

interface Props {
  data: DashboardData
  selectedDecks: string[]
  fields: Record<string, string>
  onFieldChange: (deck: string, field: string) => void
}

export function IPlusOneContent({
  data,
  selectedDecks,
  fields,
  onFieldChange,
}: Props) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
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
  const filteredWords = useMemo(() => {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return data.iPlusOneWords
    return data.iPlusOneWords.filter(({ word, sources }) =>
      `${word} ${sources.join(' ')}`
        .toLocaleLowerCase()
        .includes(normalizedQuery.toLocaleLowerCase()),
    )
  }, [data.iPlusOneWords, query])
  const pageCount = Math.max(1, Math.ceil(filteredWords.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleWords = filteredWords.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  return (
    <Stack sx={{ gap: 2.5 }}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Vocabulary fields
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose the field that contains Chinese words in each deck.
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            sx={{ gap: 1.5, flexWrap: 'wrap' }}
          >
            {selectedDecks.map((deck, index) => {
              const options = data.fieldOptions[deck] ?? []
              const labelId = `i-plus-one-field-${index}`
              return (
                <FormControl
                  size="small"
                  key={deck}
                  disabled={options.length === 0}
                  sx={{ minWidth: 180, flex: { sm: '1 1 220px' } }}
                >
                  <InputLabel id={labelId}>{deck}</InputLabel>
                  <Select
                    labelId={labelId}
                    label={deck}
                    value={effectiveFields[deck] ?? ''}
                    onChange={(event) =>
                      onFieldChange(deck, event.target.value)
                    }
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
        </CardContent>
      </Card>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(2, 240px)' },
          gap: 1.5,
        }}
      >
        <Card variant="outlined">
          <CardContent>
            <TranslateRounded color="primary" />
            <Typography variant="h5" sx={{ mt: 1, fontWeight: 750 }}>
              {data.wellKnownHanzi.length.toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              well-known hanzi
            </Typography>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <AutoAwesomeRounded color="secondary" />
            <Typography variant="h5" sx={{ mt: 1, fontWeight: 750 }}>
              {data.iPlusOneWords.length.toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              i + 1 words
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Well-known hanzi
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Characters found in words whose latest review interval is over 360
            days.
          </Typography>
          {data.wellKnownHanzi.length ? (
            <Typography
              lang="zh-Hans"
              sx={{
                fontSize: '1.35rem',
                lineHeight: 1.8,
                letterSpacing: '0.08em',
                overflowWrap: 'anywhere',
              }}
            >
              {data.wellKnownHanzi.join(' ')}
            </Typography>
          ) : (
            <Alert severity="info">
              No well-known hanzi were found in the selected decks.
            </Alert>
          )}
        </CardContent>
      </Card>

      <Box>
        <Typography variant="h5" sx={{ fontWeight: 750 }}>
          i + 1 words
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Unseen HSK and SUBTLEX-CH words made entirely from your well-known
          hanzi. Tap a word to look it up in Pleco.
        </Typography>
      </Box>

      <TextField
        label="Search i + 1 words"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setPage(1)
        }}
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded />
              </InputAdornment>
            ),
          },
        }}
      />

      {visibleWords.length ? (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                sm: 'repeat(3, minmax(0, 1fr))',
                md: 'repeat(5, minmax(0, 1fr))',
                lg: 'repeat(6, minmax(0, 1fr))',
              },
              gap: 1.25,
            }}
          >
            {visibleWords.map(({ word, sources }) => (
              <Card variant="outlined" key={word}>
                <CardActionArea
                  component="a"
                  href={plecoUrl(word)}
                  aria-label={`Look up ${word} in Pleco`}
                  sx={{ minHeight: 92, height: '100%' }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 1.5 }}>
                    <Stack
                      direction="row"
                      sx={{
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0.5,
                      }}
                    >
                      <Typography
                        lang="zh-Hans"
                        sx={{
                          fontSize: { xs: '1.35rem', sm: '1.5rem' },
                          fontWeight: 650,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {word}
                      </Typography>
                      <OpenInNewRounded
                        color="action"
                        sx={{ fontSize: '0.9rem', flexShrink: 0 }}
                      />
                    </Stack>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.5 }}
                    >
                      {sources.join(' · ')}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
          {pageCount > 1 && (
            <Stack sx={{ alignItems: 'center' }}>
              <Pagination
                count={pageCount}
                page={currentPage}
                onChange={(_, nextPage) => {
                  setPage(nextPage)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                color="primary"
                siblingCount={0}
              />
            </Stack>
          )}
        </>
      ) : (
        <Alert severity="info">
          {query
            ? 'No i + 1 words match this search.'
            : 'No i + 1 words were found for the selected decks.'}
        </Alert>
      )}

      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Chip label="HSK 1–6 (2.0)" size="small" variant="outlined" />
        <Chip label="HSK 1–6, 7–9 (3.0)" size="small" variant="outlined" />
        <Chip label="SUBTLEX-CH ranks 1–10,000" size="small" variant="outlined" />
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Lists from{' '}
        <Link
          href="https://github.com/TepMex/cjk-lists"
          target="_blank"
          rel="noreferrer"
        >
          TepMex/cjk-lists
        </Link>
        . SUBTLEX-CH: Cai &amp; Brysbaert (2010),{' '}
        <Link
          href="https://doi.org/10.1371/journal.pone.0010729"
          target="_blank"
          rel="noreferrer"
        >
          PLOS ONE 5(6), e10729
        </Link>
        .
      </Typography>
    </Stack>
  )
}
