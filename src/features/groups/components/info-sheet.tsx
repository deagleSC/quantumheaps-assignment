import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet'
import { useConversationStore, useUiStore } from '@/store'
import type { ConversationId } from '@/types/common.types'
import { InfoPanelBody } from './info-panel'

/** Tablet/mobile version: the same panel in a slide-in drawer. */
export function InfoSheet({ conversationId }: { conversationId: ConversationId }) {
  const open = useUiStore((s) => s.isInfoPanelOpen)
  const setOpen = useUiStore((s) => s.setInfoPanelOpen)
  const isGroup = useConversationStore((s) => s.byId[conversationId]?.type === 'group')
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-sm">
        <SheetHeader className="border-b">
          <SheetTitle>{isGroup ? 'Group info' : 'Contact info'}</SheetTitle>
          <SheetDescription className="sr-only">
            {isGroup ? 'Group details and members' : 'Contact details'}
          </SheetDescription>
        </SheetHeader>
        <InfoPanelBody conversationId={conversationId} />
      </SheetContent>
    </Sheet>
  )
}
