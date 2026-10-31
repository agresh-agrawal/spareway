import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { PageHeader, PlainButton, TripStatusChip } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { queryKeys } from '@/lib/queryKeys'
import { fetchTripBasics } from '../api'
import { LoadPlanView } from '../components/LoadPlanView'

/** /trips/:tripId/plan — the 3D load plan full screen. */
export default function LoadPlanPage() {
  const { tripId = '' } = useParams()
  const { t, td } = useLang('load-planner')
  const navigate = useNavigate()
  // same query as usePlanForTrip → no second request
  const { data } = useQuery({ queryKey: [...queryKeys.trip(tripId), 'planBasics'], queryFn: () => fetchTripBasics(tripId) })
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate(`/trips/${tripId}`))
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col">
      <PlainButton icon={ArrowLeft} onClick={back} className="mb-4 self-start">
        {t('backToTrip')}
      </PlainButton>
      <PageHeader
        title={data ? `${t('title')} · ${data.trip.code}` : t('title')}
        subtitle={data ? `${data.truck.reg_no} · ${td(data.truck.model)}` : undefined}
        actions={data ? <TripStatusChip status={data.trip.status} /> : undefined}
      />
      <LoadPlanView tripId={tripId} variant="page" />
    </div>
  )
}
