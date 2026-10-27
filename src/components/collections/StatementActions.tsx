import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { collectStatement, extendStatement } from '../../api/cashCollections'
import type { StatementDetail } from '../../api/cashCollections'
import { ApiError } from '../../api/errors'
import { ar, addDays, collectionErrorMessage, formatDay, formatWeek } from '../../i18n/collections'
import { DEFAULT_FILTERS, writeFilters } from '../../pages/collectionFilters'
import { Money } from './Money'

export type Notice = {
  kind: 'success' | 'error'
  text: string
  /** Somewhere useful to go next, shown after the text. */
  link?: { to: string; label: string }
}

type Mode = 'collect' | 'extend' | null

const NOTE_MAX = 500

/** Where "view collected" goes: the tab with what was collected this month. */
const MONTH_VIEW = { ...DEFAULT_FILTERS, view: 'month' } as const

/** Errors that mean "what you were looking at is out of date": reload the statement. */
const STALE_CODES = ['amount_changed', 'nothing_due', 'already_extended']

function isStale(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 409) return false
  const code = (error.errors as { code?: unknown } | null)?.code
  return typeof code === 'string' && STALE_CODES.includes(code)
}

/**
 * Confirm a collection, or extend the week. Each one first asks "are you sure?"
 * with the exact figures, because neither can be undone from this screen.
 *
 * Collecting sends the amount that is on screen. If the amount changed in the
 * meantime the server refuses, and the statement is reloaded so it is looked
 * at again.
 */
export function StatementActions({
  statement,
  onNotice,
}: {
  statement: StatementDetail
  onNotice: (notice: Notice | null) => void
}) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<Mode>(null)
  const [note, setNote] = useState('')

  const salonId = statement.salon.id
  const weekStart = statement.week_start
  const detailKey = ['collections', 'detail', String(salonId), weekStart]

  function close() {
    setMode(null)
    setNote('')
  }

  function afterSuccess(data: StatementDetail, notice: Notice) {
    queryClient.setQueryData(detailKey, data)
    void queryClient.invalidateQueries({ queryKey: ['collections', 'list'] })
    onNotice(notice)
    close()
  }

  function afterError(error: unknown) {
    onNotice({ kind: 'error', text: collectionErrorMessage(error) })
    if (isStale(error)) {
      void queryClient.invalidateQueries({ queryKey: detailKey })
      close()
    }
  }

  const collect = useMutation({
    // The amount sent is the one on screen, so the server can tell if it changed.
    mutationFn: () =>
      collectStatement(salonId, weekStart, { expected_amount: statement.due_total, note: note.trim() }),
    onSuccess: (data) =>
      afterSuccess(data, {
        kind: 'success',
        text: ar.actions.collectedDone,
        link: { to: `/collections?${writeFilters(MONTH_VIEW)}`, label: ar.actions.viewCollected },
      }),
    onError: afterError,
  })

  const extend = useMutation({
    mutationFn: () => extendStatement(salonId, weekStart, { note: note.trim() }),
    onSuccess: (data) =>
      afterSuccess(data, { kind: 'success', text: ar.actions.extendedDone(formatDay(data.due_date)) }),
    onError: afterError,
  })

  const busy = collect.isPending || extend.isPending

  if (statement.status === 'COLLECTED') {
    return (
      <section>
        <h2>{ar.actions.title}</h2>
        <p className="muted">{ar.actions.allCollected}</p>
      </section>
    )
  }

  return (
    <section>
      <h2>{ar.actions.title}</h2>

      {mode === null && (
        <>
          <div className="actions">
            <button onClick={() => { onNotice(null); setMode('collect') }}>{ar.actions.collect}</button>
            <button
              className="secondary"
              disabled={statement.extended}
              onClick={() => { onNotice(null); setMode('extend') }}
            >
              {ar.actions.extend}
            </button>
          </div>
          {statement.extended && <p className="muted">{ar.actions.alreadyExtended}</p>}
        </>
      )}

      {mode !== null && (
        <form
          className="panel"
          aria-label={mode === 'collect' ? ar.actions.collect : ar.actions.extend}
          onSubmit={(e) => {
            e.preventDefault()
            if (busy) return
            if (mode === 'collect') collect.mutate()
            else extend.mutate()
          }}
        >
          {mode === 'collect' ? (
            <p>
              {ar.actions.collectQuestionStart} <strong><Money value={statement.due_total} /></strong>{' '}
              {ar.actions.collectQuestionSalon} «<span dir="auto">{statement.salon.name}</span>»{' '}
              {ar.actions.collectQuestionWeek} {formatWeek(statement.week_start, statement.week_end)}؟
            </p>
          ) : (
            <p>
              {ar.actions.extendQuestion} <strong>{formatDay(addDays(statement.due_date, 7))}</strong>.{' '}
              {ar.actions.extendOnce}
            </p>
          )}

          <div className="field">
            <label htmlFor="note">{ar.actions.noteLabel}</label>
            <textarea
              id="note"
              rows={3}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy}
              dir="auto"
            />
          </div>

          <div className="actions">
            <button type="submit" disabled={busy}>
              {busy
                ? ar.actions.saving
                : mode === 'collect'
                  ? ar.actions.collectConfirm
                  : ar.actions.extendConfirm}
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={close}>
              {ar.actions.cancel}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
