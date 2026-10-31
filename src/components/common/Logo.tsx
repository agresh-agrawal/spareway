import { cn } from '@/lib/cn'

export function Logo({ withWord = true, className }: { withWord?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img src="/brand/spareway-mark.svg" alt="" className="size-9 rounded-[10px]" />
      {withWord && <span className="text-[20px] font-semibold tracking-tight">Spareway</span>}
    </span>
  )
}
