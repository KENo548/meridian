import { STATUS_LABELS } from '@/constants'
import { Badge } from '@/components/ui/Badge'
import type { ApplicationStatus } from '@/types'
import type { ComponentProps } from 'react'

type Tone = ComponentProps<typeof Badge>['tone']

const STATUS_TONE: Record<ApplicationStatus, Tone> = {
  interested: 'neutral',
  to_apply: 'info',
  preparing: 'warning',
  applied: 'teal',
  online_assessment: 'teal',
  first_interview: 'accent',
  second_interview: 'accent',
  final_interview: 'accent',
  assessment_centre: 'accent',
  superday: 'accent',
  offer: 'success',
  accepted: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
  ghosted: 'neutral',
  closed: 'neutral',
}

interface StatusBadgeProps {
  status: ApplicationStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge tone={STATUS_TONE[status]} className={className}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
