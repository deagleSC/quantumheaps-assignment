import { SendHorizontal } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/shared/components/ui/input-group'
import { Kbd } from '@/shared/components/ui/kbd'
import { messageActions, useUiStore } from '@/store'
import type { ConversationId } from '@/types/common.types'
import { ReplyPreview } from './reply-preview'

interface ComposerValues {
  content: string
}

export const MAX_MESSAGE_LENGTH = 4000

/** Focus the composer on devices with a precise pointer (avoids popping mobile keyboards). */
const shouldAutoFocus = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches

/**
 * Message input (React Hook Form + shadcn InputGroup).
 * Enter sends, Shift+Enter adds a new line, Esc cancels a reply.
 */
export function MessageComposer({ conversationId }: { conversationId: ConversationId }) {
  const replyingToId = useUiStore((s) => s.replyingToId)
  const setReplyingTo = useUiStore((s) => s.setReplyingTo)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const { register, handleSubmit, reset, watch } = useForm<ComposerValues>({
    defaultValues: { content: '' },
  })
  const { ref: registerRef, ...field } = register('content', { maxLength: MAX_MESSAGE_LENGTH })
  const canSend = watch('content').trim().length > 0

  useEffect(() => {
    if (shouldAutoFocus()) textareaRef.current?.focus()
  }, [conversationId])

  // Starting a reply moves focus to the input.
  useEffect(() => {
    if (replyingToId) textareaRef.current?.focus()
  }, [replyingToId])

  const submit = handleSubmit(({ content }) => {
    if (!content.trim()) return
    void messageActions.send({ conversationId, content, replyToId: replyingToId ?? undefined })
    reset()
    textareaRef.current?.focus()
  })

  return (
    <div className="bg-background shrink-0 border-t">
      <ReplyPreview />
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
            placeholder="Type a message"
            aria-label="Message"
            className="[field-sizing:content] max-h-40 min-h-11 py-3 text-[15px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void submit()
              } else if (e.key === 'Escape' && replyingToId) {
                e.preventDefault()
                setReplyingTo(null)
              }
            }}
          />
          <InputGroupAddon align="inline-end" className="self-end pb-2">
            <InputGroupButton
              type="submit"
              size="icon-sm"
              variant="default"
              disabled={!canSend}
              aria-label="Send message"
              className="rounded-full"
            >
              <SendHorizontal />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <p className="text-muted-foreground mt-1.5 hidden px-1 text-[11px] md:block">
          <Kbd>Enter</Kbd> to send · <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd> for a new line
        </p>
      </form>
    </div>
  )
}
