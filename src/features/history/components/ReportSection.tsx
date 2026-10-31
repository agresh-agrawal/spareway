// Settings: the monthly email report (owner request 6) — sent on the 1st of each month; preview it or send last
// month's report now. Talks to the monthly-report Edge Function.
import { useState } from 'react'
import { Eye, Mail, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardHeader, MainButton, PlainButton, Sheet } from '@/components/common'
import { useAuth } from '@/app/auth/AuthProvider'
import { getSupabase } from '@/lib/supabase'
import { isFixtureMode } from '@/lib/fixtures'
import { useLang } from '@/lib/i18n'

type Reply = { ok: boolean; html?: string; sentTo?: string; error?: { code: string } }

async function callReport(body: Record<string, unknown>): Promise<Reply> {
  const { data, error } = await getSupabase().functions.invoke('monthly-report', { body })
  if (error) {
    // non-2xx: the function still answers { ok:false, error:{code} }
    const ctx = (error as { context?: Response }).context
    const reply = ctx ? ((await ctx.json().catch(() => null)) as Reply | null) : null
    return reply ?? { ok: false, error: { code: 'NETWORK' } }
  }
  return data as Reply
}

export function ReportSection() {
  const { t } = useLang('history')
  const { user } = useAuth()
  const [busy, setBusy] = useState<'preview' | 'send' | null>(null)
  const [html, setHtml] = useState<string | null>(null)
  const demo = isFixtureMode()

  const fail = (code?: string) => toast.error(code === 'EMAIL_NOT_SET_UP' ? t('report.notSetUp') : t('report.failed'))

  const preview = async () => {
    setBusy('preview')
    try {
      const r = await callReport({ mode: 'me', dryRun: true })
      if (r.ok && r.html) setHtml(r.html)
      else fail(r.error?.code)
    } finally {
      setBusy(null)
    }
  }
  const send = async () => {
    setBusy('send')
    try {
      const r = await callReport({ mode: 'me' })
      if (r.ok) toast.success(t('report.sent', { email: r.sentTo ?? user?.email ?? '' }))
      else fail(r.error?.code)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader icon={Mail} title={t('report.title')} />
      <p className="mb-4 text-ink-2">{t('report.text', { email: user?.email ?? '' })}</p>
      {demo ? (
        <p className="text-ink-2">{t('report.demo')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <PlainButton icon={Eye} onClick={preview} loading={busy === 'preview'}>
            {t('report.preview')}
          </PlainButton>
          <MainButton icon={Send} onClick={send} loading={busy === 'send'}>
            {t('report.sendNow')}
          </MainButton>
        </div>
      )}
      <Sheet open={html !== null} onOpenChange={(o) => !o && setHtml(null)} title={t('report.previewTitle')}>
        {html && <iframe title={t('report.previewTitle')} srcDoc={html} sandbox="" className="h-[70vh] w-full rounded-tile border border-line bg-white" />}
      </Sheet>
    </Card>
  )
}
