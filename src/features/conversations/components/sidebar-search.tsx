import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Input } from '@/shared/components/ui/input'
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value'
import { useUiStore } from '@/store'

export const CONVERSATION_SEARCH_ID = 'conversation-search'

/** Search box; the store (and the filtering) update 300 ms after typing stops. */
export function SidebarSearch() {
  const setSearch = useUiStore((s) => s.setSearch)
  const [value, setValue] = useState(() => useUiStore.getState().search)
  const debounced = useDebouncedValue(value, 300)

  useEffect(() => {
    setSearch(debounced)
  }, [debounced, setSearch])

  const clear = () => {
    setValue('')
    setSearch('')
  }

  return (
    <div className="relative">
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden
      />
      <Input
        id={CONVERSATION_SEARCH_ID}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.stopPropagation()
            clear()
          }
        }}
        placeholder="Search chats"
        aria-label="Search chats"
        autoComplete="off"
        className="bg-muted/60 border-transparent pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}
