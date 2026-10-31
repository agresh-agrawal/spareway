import { Switch as S } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export function Switch({ className, ...props }: ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-line-strong bg-surface-3 transition-colors duration-200',
        'data-[state=checked]:border-accent data-[state=checked]:bg-accent',
        className,
      )}
      {...props}
    >
      <S.Thumb className="block size-5 translate-x-1 rounded-full bg-ink transition-transform duration-200 data-[state=checked]:translate-x-6 data-[state=checked]:bg-accent-ink" />
    </S.Root>
  )
}
