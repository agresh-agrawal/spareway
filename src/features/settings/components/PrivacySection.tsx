// Settings: what Spareway keeps and for how long (privacy, roadmap item 15), and "Delete my account".
// Deleting removes the login; when nobody else is in the company, the company and everything in it goes too
// (delete_my_account, prephase4code_privacy.sql). The owner must type DELETE.
import { useState } from 'react'
import { toast } from 'sonner'
import { ShieldCheck, Trash2 } from 'lucide-react'
import { Card, CardHeader, MainButton, PlainButton, Sheet, TextField } from '@/components/common'
import { useAuth } from '@/app/auth/AuthProvider'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { deleteMyAccount } from '../api'

const POINTS = ['data', 'location', 'photos', 'links', 'email', 'never'] as const

export function PrivacySection() {
  const { t } = useLang('settings')
  const { signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const remove = async () => {
    setBusy(true)
    try {
      await deleteMyAccount(word.trim())
      toast.success(t('privacy.deleted'))
      setOpen(false)
      await signOut().catch(() => undefined)
    } catch (e) {
      toast.error(t(`common:errors.${toAppError(e).code}`))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <CardHeader icon={ShieldCheck} title={t('privacy.title')} />
      <ul className="mb-5 flex list-disc flex-col gap-2 pl-5 text-ink-2">
        {POINTS.map((k) => (
          <li key={k}>{t(`privacy.points.${k}`)}</li>
        ))}
      </ul>
      <PlainButton icon={Trash2} tone="danger" onClick={() => setOpen(true)}>
        {t('privacy.delete')}
      </PlainButton>
      <Sheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setWord('')
        }}
        title={t('privacy.deleteTitle')}
        description={t('privacy.deleteText')}
        footer={
          <MainButton icon={Trash2} disabled={word.trim() !== 'DELETE'} loading={busy} onClick={remove} className="w-full">
            {t('privacy.deleteForever')}
          </MainButton>
        }
      >
        <TextField
          label={t('privacy.typeDelete')}
          value={word}
          onChange={(e) => setWord(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
        />
      </Sheet>
    </Card>
  )
}
