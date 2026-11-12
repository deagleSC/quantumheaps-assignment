/** Animated three-dot bubble with a label like "Priya is typing…". */
export function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-end gap-2 px-4 pt-1 pb-2" aria-live="polite">
      <div
        className="bg-bubble-in flex h-9 items-center gap-1 rounded-[10px] rounded-bl-[3px] px-3.5 shadow-(--bubble-shadow)"
        aria-hidden
      >
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full"
            style={{ animationDelay: `${delay}ms`, animationDuration: '1s' }}
          />
        ))}
      </div>
      <span className="text-muted-foreground pb-1 text-xs">{label}</span>
    </div>
  )
}
