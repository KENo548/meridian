import type {
  ApplicationFilters,
  ApplicationStatus,
  AssessmentType,
  CompanyType,
  DeadlineType,
  Division,
  DocumentRequirement,
  DocumentType,
  EligibleUniversityYear,
  LanguageNeed,
  Priority,
  RecommendedTiming,
  RequirementStatus,
  RequirementType,
  RoleType,
  Source,
  Specialization,
  WorkArrangement,
  WorkAuthorization,
} from '@/types'

export const APP_NAME = 'Meridian'
export const APP_TAGLINE = 'Finance recruiting command centre'

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  researching: 'Researching',
  watching: 'Watching',
  not_open: 'Not Open',
  interested: 'Interested',
  to_apply: 'To Apply',
  application_started: 'Application Started',
  preparing: 'Preparing',
  applied: 'Applied',
  online_assessment: 'Online Assessment',
  hirevue: 'HireVue',
  phone_interview: 'Phone Interview',
  first_interview: 'First Interview',
  first_round: 'First Round',
  second_interview: 'Second Interview',
  second_round: 'Second Round',
  final_interview: 'Final Interview',
  assessment_centre: 'Assessment Centre',
  superday: 'Superday',
  offer: 'Offer',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  ghosted: 'Ghosted',
  closed: 'Closed',
  missed_deadline: 'Missed Deadline',
}

export const STATUS_ORDER: ApplicationStatus[] = [
  'researching',
  'watching',
  'not_open',
  'interested',
  'to_apply',
  'application_started',
  'preparing',
  'applied',
  'online_assessment',
  'hirevue',
  'phone_interview',
  'first_interview',
  'first_round',
  'second_interview',
  'second_round',
  'final_interview',
  'assessment_centre',
  'superday',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'ghosted',
  'closed',
  'missed_deadline',
]

export const OPEN_STATUSES: ApplicationStatus[] = [
  'researching',
  'watching',
  'interested',
  'to_apply',
  'application_started',
  'preparing',
  'applied',
  'online_assessment',
  'hirevue',
  'phone_interview',
  'first_interview',
  'first_round',
  'second_interview',
  'second_round',
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
  'missed_deadline',
]

export const INTERVIEW_STATUSES: ApplicationStatus[] = [
  'hirevue',
  'phone_interview',
  'first_interview',
  'first_round',
  'second_interview',
  'second_round',
  'final_interview',
  'assessment_centre',
  'superday',
]

export const APPLIED_OR_BEYOND: ApplicationStatus[] = [
  'application_started',
  'applied',
  'online_assessment',
  'hirevue',
  'phone_interview',
  'first_interview',
  'first_round',
  'second_interview',
  'second_round',
  'final_interview',
  'assessment_centre',
  'superday',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'ghosted',
  'closed',
  'missed_deadline',
]

export const KANBAN_COLUMNS: { id: string; label: string; statuses: ApplicationStatus[] }[] = [
  {
    id: 'interested',
    label: 'Interested',
    statuses: ['researching', 'watching', 'interested', 'to_apply'],
  },
  { id: 'preparing', label: 'Preparing', statuses: ['application_started', 'preparing'] },
  { id: 'applied', label: 'Applied', statuses: ['applied', 'online_assessment'] },
  {
    id: 'interview',
    label: 'Interview',
    statuses: [
      'hirevue',
      'phone_interview',
      'first_interview',
      'first_round',
      'second_interview',
      'second_round',
      'final_interview',
      'assessment_centre',
      'superday',
    ],
  },
  { id: 'offer', label: 'Offer', statuses: ['offer', 'accepted'] },
  {
    id: 'rejected',
    label: 'Rejected',
    statuses: ['rejected', 'withdrawn', 'ghosted', 'closed', 'missed_deadline'],
  },
]

export const ROLE_TYPE_LABELS: Record<RoleType, string> = {
  summer_internship: 'Summer Internship',
  off_cycle_internship: 'Off-Cycle Internship',
  spring_week: 'Spring Week',
  spring_insight: 'Spring Insight',
  insight_programme: 'Insight Programme',
  first_year_programme: 'First-Year Programme',
  early_careers_programme: 'Early Careers Programme',
  diversity_programme: 'Diversity Programme',
  graduate_programme: 'Graduate Programme',
  full_time: 'Full-Time',
  part_time: 'Part-Time',
  part_time_internship: 'Part-Time Internship',
  working_student: 'Working Student',
  apprenticeship: 'Apprenticeship',
  placement: 'Placement',
  industrial_placement: 'Industrial Placement',
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
  leveraged_finance: 'Leveraged Finance',
  restructuring: 'Restructuring',
  coverage: 'Coverage',
  financial_institutions: 'Financial Institutions',
  industrials: 'Industrials',
  consumer_retail: 'Consumer & Retail',
  healthcare: 'Healthcare',
  technology_media_telecom: 'TMT',
  energy: 'Energy',
  infrastructure: 'Infrastructure',
  financial_sponsors: 'Financial Sponsors',
  sales: 'Sales',
  trading: 'Trading',
  structuring: 'Structuring',
  fixed_income: 'Fixed Income',
  equities: 'Equities',
  commodities: 'Commodities',
  fx: 'FX',
  credit: 'Credit',
  rates: 'Rates',
  derivatives: 'Derivatives',
  credit_research: 'Credit Research',
  quantitative_research: 'Quantitative Research',
  quantitative_trading: 'Quantitative Trading',
  portfolio_management: 'Portfolio Management',
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
  wealth_manager: 'Wealth Manager',
  hedge_fund: 'Hedge Fund',
  proprietary_trading: 'Proprietary Trading',
  market_maker: 'Market Maker',
  quant_firm: 'Quant Firm',
  corporate: 'Corporate',
  consulting: 'Consulting',
  big4: 'Big 4 / Advisory',
  accounting: 'Accounting',
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
  bright_network: 'Bright Network',
  handshake: 'Handshake',
  referral: 'Referral',
  university_portal: 'University Portal',
  recruiter: 'Recruiter',
  other: 'Other',
}

export const DEADLINE_TYPE_LABELS: Record<DeadlineType, string> = {
  specific: 'Specific Deadline',
  rolling: 'Rolling',
  until_filled: 'Until Filled',
  estimated: 'Estimated',
  unknown: 'Unknown',
}

export const DIVISION_LABELS: Record<Division, string> = {
  investment_banking: 'Investment Banking',
  global_banking: 'Global Banking',
  corporate_banking: 'Corporate Banking',
  capital_markets: 'Capital Markets',
  markets: 'Markets',
  sales_and_trading: 'Sales & Trading',
  equity_research: 'Equity Research',
  asset_management: 'Asset Management',
  wealth_management: 'Wealth Management',
  private_equity: 'Private Equity',
  hedge_fund: 'Hedge Fund',
  quantitative_finance: 'Quantitative Finance',
  risk: 'Risk',
  treasury: 'Treasury',
  operations: 'Operations',
  technology: 'Technology',
  strategy: 'Strategy',
  other: 'Other',
}

export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  numerical_reasoning: 'Numerical Reasoning',
  verbal_reasoning: 'Verbal Reasoning',
  logical_reasoning: 'Logical Reasoning',
  inductive_reasoning: 'Inductive Reasoning',
  deductive_reasoning: 'Deductive Reasoning',
  situational_judgement: 'Situational Judgement',
  personality: 'Personality',
  pymetrics: 'Pymetrics',
  games_based: 'Games-Based',
  coding: 'Coding',
  technical_test: 'Technical Test',
  case_study: 'Case Study',
  written_exercise: 'Written Exercise',
  hirevue: 'HireVue',
  video_interview: 'Video Interview',
  phone_interview: 'Phone Interview',
  assessment_centre: 'Assessment Centre',
  superday: 'Superday',
  other: 'Other',
}

export const ELIGIBLE_YEAR_LABELS: Record<EligibleUniversityYear, string> = {
  first_year: 'First Year',
  second_year: 'Second Year',
  penultimate_year: 'Penultimate Year',
  final_year: 'Final Year',
  masters: 'Masters',
  phd: 'PhD',
  graduate: 'Graduate',
  other: 'Other',
  unknown: 'Unknown',
}

export const DOC_REQUIREMENT_LABELS: Record<DocumentRequirement, string> = {
  yes: 'Required',
  no: 'Not Required',
  optional: 'Optional',
  unknown: 'Unknown',
}

export const WORK_AUTH_LABELS: Record<WorkAuthorization, string> = {
  sponsorship_available: 'Sponsorship Available',
  sponsorship_not_available: 'No Sponsorship',
  existing_authorization_required: 'Existing Authorization Required',
  unclear: 'Unclear',
  not_applicable: 'Not Applicable',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const RECOMMENDED_TIMING_LABELS: Record<RecommendedTiming, string> = {
  immediately: 'Immediately',
  within_3_days: 'Within 3 Days',
  within_1_week: 'Within 1 Week',
  before_deadline: 'Before Deadline',
  unknown: 'Unknown',
}

export const LANGUAGE_NEED_LABELS: Record<LanguageNeed, string> = {
  required: 'Required',
  preferred: 'Preferred',
  optional: 'Optional',
  unknown: 'Unknown',
}

export const WORK_MODE_LABELS: Record<WorkArrangement, string> = {
  onsite: 'Onsite',
  hybrid: 'Hybrid',
  remote: 'Remote',
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

/**
 * Durable initialization marker. This tag is seeded alongside default tags
 * in a single import call and serves as proof that the workspace has been
 * through first-launch initialization. Hydration checks for its presence
 * before attempting to seed defaults.
 *
 * Hidden from the UI — tag list filters exclude names starting with '_system:'.
 */
export const WORKSPACE_INIT_SENTINEL = '_system:initialized'

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

/**
 * Default saved views. Every entry is a plain partial filter
 * configuration — the same model user-created views serialize.
 * No view has special filtering logic.
 */
export const DEFAULT_SAVED_VIEWS: Array<{ name: string; filters: Partial<ApplicationFilters> }> = [
  {
    name: 'Apply Now',
    filters: { statuses: ['to_apply', 'application_started'] as ApplicationStatus[] },
  },
  {
    name: 'Spring Weeks / Insights',
    filters: { roleTypes: ['spring_week', 'spring_insight', 'insight_programme'] },
  },
  {
    name: 'First-Year Eligible',
    filters: { eligibleUniversityYears: ['first_year'] },
  },
  { name: 'Summer Internships', filters: { roleTypes: ['summer_internship'] } },
  { name: 'Rolling Applications', filters: { deadlineTypes: ['rolling'] } },
  { name: 'Upcoming Deadlines', filters: { deadlineWithinDays: 14 } },
  { name: 'High Priority', filters: { priorities: ['high'] } },
  { name: 'No Cover Letter', filters: { coverLetterRequired: ['no'] } },
  { name: 'London', filters: { cities: ['London'] } },
  { name: 'Investment Banking', filters: { specializations: ['investment_banking'] } },
  {
    name: 'Not Yet Submitted',
    filters: { statuses: ['interested', 'to_apply', 'preparing'] as ApplicationStatus[] },
  },
  {
    name: 'Interviews',
    filters: {
      statuses: [
        'hirevue',
        'phone_interview',
        'first_interview',
        'first_round',
        'second_interview',
        'second_round',
        'final_interview',
        'assessment_centre',
        'superday',
      ] as ApplicationStatus[],
    },
  },
  { name: 'Offers', filters: { statuses: ['offer', 'accepted'] as ApplicationStatus[] } },
]
