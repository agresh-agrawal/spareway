import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRealtime } from '@/lib/realtime'
import { getEmailNotify, listNotices, markAllRead, markRead, setEmailNotify } from './api'

export const noticesKey = ['notifications'] as const
const emailKey = ['notifications', 'email'] as const

/** Latest notifications, live (realtime on the notifications table). */
export function useNotices(enabled = true) {
  useRealtime('notifications', [noticesKey], undefined, enabled)
  return useQuery({ queryKey: noticesKey, queryFn: listNotices, enabled })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: markRead, onSettled: () => qc.invalidateQueries({ queryKey: noticesKey }) })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: markAllRead, onSettled: () => qc.invalidateQueries({ queryKey: noticesKey }) })
}

export function useEmailNotify() {
  return useQuery({ queryKey: emailKey, queryFn: getEmailNotify })
}

export function useSetEmailNotify() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: setEmailNotify, onSettled: () => qc.invalidateQueries({ queryKey: emailKey }) })
}
