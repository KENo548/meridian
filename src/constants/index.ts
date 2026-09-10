import type {
  ApplicationStatus,
  CompanyType,
  DeadlineType,
  DocumentType,
  RequirementStatus,
  RequirementType,
  RoleType,
  Source,
  Specialization,
} from '@/types'

export const APP_NAME = 'Meridian'
export const APP_TAGLINE = 'Finance recruiting command centre'

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  interested: 'Interested',
  to_apply: 'To Apply',
  preparing: 'Preparing',
  applied: 'Applied',
  online_assessment: 'Online Assessment',
  first_interview: 'First Interview',
  second_interview: 'Second Interview',
  final_interview: 'Final Interview',
  assessment_centre: 'Assessment Centre',
  superday: 'Superday',
  offer: 'Offer',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  ghosted: 'Ghosted',
  closed: 'Closed',
}

export const STATUS_ORDER: ApplicationStatus[] = [
  'interested',
  'to_apply',
  'preparing',
  'applied',
  'online_assessment',
  'first_interview',
  'second_interview',
  'final_interview',
  'assessment_centre',
  'superday',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'ghosted',
  'closed',
]

export const OPEN_STATUSES: ApplicationStatus[] = [
  'interested',
  'to_apply',
  'preparing',
  'applied',
  'online_assessment',
  'first_interview',
  'second_interview',
  'final_interview',
  'assessment_centre',
  'superday',
  'offer',
]

export const CLOSED_STATUSES: ApplicationStatus[] = [
  'accepted',
  'rejected',
  'withdrawn',
  'ghosted',
  'closed',
]

export const INTERVIEW_STATUSES: ApplicationStatus[] = [
  'first_interview',
  'second_interview',
  'final_interview',
  'assessment_centre',
  'superday',
]

export const APPLIED_OR_BEYOND: ApplicationStatus[] = [
  'applied',
  'online_assessment',
  'first_interview',
  'second_interview',
  'final_interview',
  'assessment_centre',
  'superday',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'ghosted',
  'closed',
]

export const KANBAN_COLUMNS: { id: string; label: string; statuses: ApplicationStatus[] }[] = [
  { id: 'interested', label: 'Interested', statuses: ['interested', 'to_apply'] },
  { id: 'preparing', label: 'Preparing', statuses: ['preparing'] },
  { id: 'applied', label: 'Applied', statuses: ['applied', 'online_assessment'] },
  {
    id: 'interview',
    label: 'Interview',
    statuses: [
      'first_interview',
      'second_interview',
      'final_interview',
      'assessment_centre',
      'superday',
    ],
  },
  { id: 'offer', label: 'Offer', statuses: ['offer', 'accepted'] },
  { id: 'rejected', label: 'Rejected', statuses: ['rejected', 'withdrawn', 'ghosted', 'closed'] },
]

export const ROLE_TYPE_LABELS: Record<RoleType, string> = {
  summer_internship: 'Summer Internship',
  off_cycle_internship: 'Off-Cycle Internship',
  spring_week: 'Spring Week',
  graduate_programme: 'Graduate Programme',
  full_time: 'Full-Time',
  part_time: 'Part-Time',
  working_student: 'Working Student',
  apprenticeship: 'Apprenticeship',
  placement: 'Placement',
  other: 'Other',
}

export const SPECIALIZATION_LABELS: Record<Specialization, string> = {
  investment_banking: 'Investment Banking',
  private_equity: 'Private Equity',
  venture_capital: 'Venture Capital',
  asset_management: 'Asset Management',
  sales_trading: 'Sales & Trading',
  equity_research: 'Equity Research',
  dcm: 'Debt Capital Markets',
  ecm: 'Equity Capital Markets',
  corporate_finance: 'Corporate Finance',
  manda: 'M&A',
  transaction_services: 'Transaction Services',
  private_credit: 'Private Credit',
  quantitative_finance: 'Quantitative Finance',
  risk: 'Risk',
  consulting: 'Consulting',
  corporate_development: 'Corporate Development',
  real_estate: 'Real Estate',
  other: 'Other',
}

export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  bulge_bracket: 'Bulge Bracket',
  elite_boutique: 'Elite Boutique',
  middle_market: 'Middle Market',
  boutique: 'Boutique',
  private_equity: 'Private Equity',
  venture_capital: 'Venture Capital',
  asset_management: 'Asset Management',
  hedge_fund: 'Hedge Fund',
  corporate: 'Corporate',
  consulting: 'Consulting',
  big4: 'Big 4 / Advisory',
  fintech: 'Fintech',
  other: 'Other',
}

export const SOURCE_LABELS: Record<Source, string> = {
  company_website: 'Company Website',
  linkedin: 'LinkedIn',
  fyntraq: 'Fyntraq',
  trackr: 'Trackr',
  jobortunity: 'Jobortunity',
  indeed: 'Indeed',
  efinancialcareers: 'eFinancialCareers',
  referral: 'Referral',
  university_portal: 'University Portal',
  recruiter: 'Recruiter',
  other: 'Other',
}

export const DEADLINE_TYPE_LABELS: Record<DeadlineType, string> = {
  specific: 'Specific Deadline',
  rolling: 'Rolling',
  until_filled: 'Until Filled',
  unknown: 'Unknown',
}

export const REQUIREMENT_TYPE_LABELS: Record<RequirementType, string> = {
  cv: 'CV',
  cover_letter: 'Cover Letter',
  essay: 'Essay',
  personal_statement: 'Personal Statement',
  transcript: 'Transcript',
  university_transcript: 'University Transcript',
  degree_certificate: 'Degree Certificate',
  references: 'References',
  recommendation_letter: 'Recommendation Letter',
  portfolio: 'Portfolio',
  writing_sample: 'Writing Sample',
  motivation_letter: 'Motivation Letter',
  video_interview: 'Video Interview',
  online_assessment: 'Online Assessment',
  numerical_test: 'Numerical Test',
  logical_reasoning_test: 'Logical Reasoning Test',
  verbal_reasoning_test: 'Verbal Reasoning Test',
  situational_judgement_test: 'Situational Judgement Test',
  coding_test: 'Coding Test',
  case_study: 'Case Study',
  presentation: 'Presentation',
  additional_questions: 'Additional Questions',
  diversity_questions: 'Diversity Questions',
  work_authorization: 'Work Authorization',
  visa_information: 'Visa Information',
  other: 'Other',
}

export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  not_required: 'Not Required',
  required: 'Required',
  in_progress: 'In Progress',
  completed: 'Completed',
  submitted: 'Submitted',
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  cv: 'CV',
  cover_letter: 'Cover Letter',
  transcript: 'Transcript',
  essay: 'Essay',
  personal_statement: 'Personal Statement',
  writing_sample: 'Writing Sample',
  portfolio: 'Portfolio',
  other: 'Other',
}

export const DEFAULT_REQUIREMENT_TYPES: RequirementType[] = [
  'cv',
  'cover_letter',
  'transcript',
  'motivation_letter',
  'online_assessment',
  'video_interview',
  'essay',
]

export const DEFAULT_TAGS = [
  'Priority',
  'Dream Company',
  'Networking',
  'Target',
  'Safety',
  'London',
  'Frankfurt',
  'PE',
  'IB',
  'Markets',
  'Urgent',
  'Spring Week',
  'Summer 2027',
]

export const DEFAULT_SAVED_VIEWS = [
  { name: 'Due This Week', filters: { deadlinePreset: 'this_week' as const } },
  { name: 'Investment Banking', filters: { specializations: ['investment_banking' as const] } },
  { name: 'London', filters: { cities: ['London'] } },
  { name: 'Frankfurt', filters: { cities: ['Frankfurt'] } },
  { name: 'Private Equity', filters: { specializations: ['private_equity' as const] } },
  {
    name: 'Not Yet Submitted',
    filters: { statuses: ['interested', 'to_apply', 'preparing'] as ApplicationStatus[] },
  },
  {
    name: 'Interviews',
    filters: {
      statuses: [
        'first_interview',
        'second_interview',
        'final_interview',
        'assessment_centre',
        'superday',
      ] as ApplicationStatus[],
    },
  },
  { name: 'Rejected', filters: { statuses: ['rejected'] as ApplicationStatus[] } },
  { name: 'Offers', filters: { statuses: ['offer', 'accepted'] as ApplicationStatus[] } },
]
