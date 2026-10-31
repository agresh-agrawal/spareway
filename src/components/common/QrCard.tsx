import { QRCodeSVG } from 'qrcode.react'
import { Copy, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { useLang } from '@/lib/i18n'
import { MainButton, PlainButton } from './Buttons'

/** Black-on-white QR 220 px + link + Copy + WhatsApp. */
export function QrCard({ url, whatsappText }: { url: string; whatsappText: string }) {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked: the link is visible to copy by hand */
    }
  }
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-tile bg-white p-4">
        <QRCodeSVG value={url} size={220} bgColor="#ffffff" fgColor="#000000" level="M" />
      </div>
      <p className="w-full truncate text-center text-label text-ink-2" title={url}>
        {url}
      </p>
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <PlainButton icon={Copy} onClick={copy} className="flex-1">
          {copied ? t('actions.copied') : t('actions.copy')}
        </PlainButton>
        <MainButton
          icon={MessageCircle}
          className="flex-1"
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(whatsappText)}`, '_blank', 'noopener')}
        >
          {t('actions.sendWhatsApp')}
        </MainButton>
      </div>
    </div>
  )
}
