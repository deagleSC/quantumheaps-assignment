import { Check, SendHorizontal } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/shared/components/ui/input-group'
import { Kbd } from '@/shared/components/ui/kbd'
import { messageActions, useMessageStore, useUiStore } from '@/store'
import type { ConversationId } from '@/types/common.types'
import { useLastOwnMessageGetter } from '../hooks/use-last-own-message'
import { EditPreview } from './edit-preview'
import { ReplyPreview } from './reply-preview'

interface ComposerValues {
  content: string
}

export const MAX_MESSAGE_LENGTH = 4000

/** Focus the composer on devices with a precise pointer (avoids popping mobile keyboards). */
const shouldAutoFocus = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches

/**
 * Message input (React Hook Form + shadcn InputGroup). Two modes:
 * - compose: Enter sends, Shift+Enter adds a line, Esc cancels a reply,
 *   ↑ in an empty box edits your last message
 * - edit: pre-filled with the message; Enter saves, Esc cancels
 */
export function MessageComposer({ conversationId }: { conversationId: ConversationId }) {
  const replyingToId = useUiStore((s) => s.replyingToId)
  const editingId = useUiStore((s) => s.editingId)
  const setReplyingTo = useUiStore((s) => s.setReplyingTo)
  const setEditing = useUiStore((s) => s.setEditing)
  const editingContent = useMessageStore((s) =>
    editingId ? s.byId[editingId]?.content : undefined,
  )
  const getLastOwnMessage = useLastOwnMessageGetter(conversationId)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const wasEditing = useRef(false)

  const { register, handleSubmit, reset, watch } = useForm<ComposerValues>({
    defaultValues: { content: '' },
  })
  const { ref: registerRef, ...field } = register('content', { maxLength: MAX_MESSAGE_LENGTH })
  const value = watch('content')
  const canSubmit = value.trim().length > 0

  const focusAtEnd = () => {
    const el = textareaRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }

  useEffect(() => {
    if (shouldAutoFocus()) textareaRef.current?.focus()
  }, [conversationId])

  // Starting a reply moves focus to the input.
  useEffect(() => {
    if (replyingToId) textareaRef.current?.focus()
  }, [replyingToId])

  // Entering edit mode pre-fills the message; leaving it clears the box.
  useEffect(() => {
    if (editingId) {
      wasEditing.current = true
      reset({ content: editingContent ?? '' })
      requestAnimationFrame(focusAtEnd)
    } else if (wasEditing.current) {
      wasEditing.current = false
      reset({ content: '' })
    }
    // Only react to switching which message is edited, not to its content changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, reset])

  const submit = handleSubmit(({ content }) => {
    if (!content.trim()) return
    if (editingId) {
      void messageActions.edit(editingId, content)
    } else {
      void messageActions.send({ conversationId, content, replyToId: replyingToId ?? undefined })
      reset()
    }
    textareaRef.current?.focus()
  })

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
    } else if (e.key === 'Escape' && (editingId || replyingToId)) {
      e.preventDefault()
      if (editingId) setEditing(null)
      else setReplyingTo(null)
    } else if (e.key === 'ArrowUp' && !value && !editingId) {
      const last = getLastOwnMessage()
      if (last) {
        e.preventDefault()
        setEditing(last)
      }
    }
  }

  return (
    <div className="bg-background shrink-0 border-t">
      {editingId ? <EditPreview /> : <ReplyPreview />}
      <form onSubmit={submit} className="p-3" aria-label="Send a message">
        <InputGroup className="bg-muted/40 rounded-2xl">
          <InputGroupTextarea
            {...field}
            ref={(el) => {
              registerRef(el)
              textareaRef.current = el
            }}
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder={editingId ? 'Edit message' : 'Type a message'}
            aria-label="Message"
            className="[field-sizing:content] max-h-40 min-h-11 py-3 text-[15px]"
            onKeyDown={onKeyDown}
          />
          <InputGroupAddon align="inline-end" className="self-end pb-2">
            <InputGroupButton
              type="submit"
              size="icon-sm"
              variant="default"
              disabled={!canSubmit}
              aria-label={editingId ? 'Save edit' : 'Send message'}
              className="rounded-full"
            >
              {editingId ? <Check /> : <SendHorizontal />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <p className="text-muted-foreground mt-1.5 hidden px-1 text-[11px] md:block">
          {editingId ? (
            <>
              <Kbd>Enter</Kbd> to save · <Kbd>Esc</Kbd> to cancel
            </>
          ) : (
            <>
              <Kbd>Enter</Kbd> to send · <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd> for a new line ·{' '}
              <Kbd>↑</Kbd> to edit your last message
            </>
          )}
        </p>
      </form>
    </div>
  )
}
