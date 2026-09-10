import { Badge } from '@/components/ui/Badge'
import { deadlineLabel, getDeadlineUrgency } from '@/lib/utils'
import type { Application } from '@/types'
import type { ComponentProps } from 'react'

type Tone = ComponentProps<typeof Badge>['tone']

interface DeadlineBadgeProps {
  application: Application
  className?: string
}

export function DeadlineBadge({ application, className }: DeadlineBadgeProps) {
  const urgency = getDeadlineUrgency(application)
  let tone: Tone = 'neutral'
  if (urgency === 'overdue') tone = 'danger'
  else if (urgency === 'due_today' || urgency === 'due_tomorrow') tone = 'warning'
  else if (urgency === 'due_this_week') tone = 'accent'
  else if (urgency === 'rolling') tone = 'teal'
  else if (urgency === 'closed') tone = 'neutral'

  return (
    <Badge tone={tone} className={className}>
      {deadlineLabel(application)}
    </Badge>
  )
}
