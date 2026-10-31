import { Home, MapPinOff } from 'lucide-react'
import { useNavigate } from 'react-router'
import { EmptyState, FullScreenMessage, MainButton } from '@/components/common'
import { useLang } from '@/lib/i18n'

export function NotFound({ inShell }: { inShell?: boolean }) {
  const { t } = useLang()
  const nav = useNavigate()
  const action = (
    <MainButton icon={Home} onClick={() => nav('/')}>
      {t('shell.goHome')}
    </MainButton>
  )
  if (inShell) return <EmptyState icon={MapPinOff} text={t('shell.notFoundText')} action={action} className="mt-8" />
  return <FullScreenMessage icon={MapPinOff} title={t('shell.notFoundTitle')} text={t('shell.notFoundText')} action={action} />
}
