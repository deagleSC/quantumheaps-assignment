import { Fragment } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Kbd, KbdGroup } from '@/shared/components/ui/kbd'
import { useUiStore } from '@/store'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl'

const SECTIONS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: 'Navigation',
    items: [
      { keys: [MOD, 'K'], label: 'Search chats' },
      { keys: ['Alt', '↑'], label: 'Previous chat' },
      { keys: ['Alt', '↓'], label: 'Next chat' },
      { keys: [MOD, 'F'], label: 'Search in this chat' },
      { keys: ['Esc'], label: 'Close search or info panel' },
      { keys: ['?'], label: 'Show this help' },
    ],
  },
  {
    title: 'Composing',
    items: [
      { keys: ['Enter'], label: 'Send message (or save an edit)' },
      { keys: ['Shift', 'Enter'], label: 'New line' },
      { keys: ['↑'], label: 'Edit your last message (empty box)' },
      { keys: ['Esc'], label: 'Cancel reply or edit' },
    ],
  },
]

export function ShortcutsDialog() {
  const open = useUiStore((s) => s.isShortcutsOpen)
  const setOpen = useUiStore((s) => s.setShortcutsOpen)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Work faster without the mouse.</DialogDescription>
        </DialogHeader>
        {SECTIONS.map((section) => (
          <section key={section.title} className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {section.title}
            </h3>
            <dl className="space-y-1.5">
              {section.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4 text-sm">
                  <dt>{item.label}</dt>
                  <dd>
                    <KbdGroup>
                      {item.keys.map((k, i) => (
                        <Fragment key={k}>
                          {i > 0 && <span className="text-muted-foreground text-xs">+</span>}
                          <Kbd>{k}</Kbd>
                        </Fragment>
                      ))}
                    </KbdGroup>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  )
}
