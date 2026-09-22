export type ApplicationStatus =
  | 'researching'
  | 'watching'
  | 'not_open'
  | 'interested'
  | 'to_apply'
  | 'application_started'
  | 'preparing'
  | 'applied'
  | 'online_assessment'
  | 'hirevue'
  | 'phone_interview'
  | 'first_interview'
  | 'first_round'
  | 'second_interview'
  | 'second_round'
  | 'final_interview'
  | 'assessment_centre'
  | 'superday'
  | 'offer'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'ghosted'
  | 'closed'
  | 'missed_deadline'

export type DeadlineType = 'specific' | 'rolling' | 'until_filled' | 'estimated' | 'unknown'

export type RoleType =
  | 'summer_internship'
  | 'off_cycle_internship'
  | 'spring_week'
  | 'spring_insight'
  | 'insight_programme'
  | 'first_year_programme'
  | 'early_careers_programme'
  | 'diversity_programme'
  | 'graduate_programme'
  | 'full_time'
  | 'part_time'
  | 'part_time_internship'
  | 'working_student'
  | 'apprenticeship'
  | 'placement'
  | 'industrial_placement'
  | 'other'

export type EmploymentType =
  | 'internship'
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'other'

export type WorkArrangement = 'onsite' | 'hybrid' | 'remote' | 'unknown'

export type CompanyType =
  | 'bulge_bracket'
  | 'elite_boutique'
  | 'middle_market'
  | 'boutique'
  | 'private_equity'
  | 'venture_capital'
  | 'asset_management'
  | 'wealth_manager'
  | 'hedge_fund'
  | 'proprietary_trading'
  | 'market_maker'
  | 'quant_firm'
  | 'corporate'
  | 'consulting'
  | 'big4'
  | 'accounting'
  | 'fintech'
  | 'other'

/**
 * Controlled division taxonomy (V2). `Application.division` (legacy free
 * text) is preserved; `divisions` is the canonical structured form.
 */
export type Division =
  | 'investment_banking'
  | 'global_banking'
  | 'corporate_banking'
  | 'capital_markets'
  | 'markets'
  | 'sales_and_trading'
  | 'equity_research'
  | 'asset_management'
  | 'wealth_management'
  | 'private_equity'
  | 'hedge_fund'
  | 'quantitative_finance'
  | 'risk'
  | 'treasury'
  | 'operations'
  | 'technology'
  | 'strategy'
  | 'other'

/**
 * Filterable assessment types (V2). Stored as an array on Application;
 * a record matches when its array intersects the selected values.
 */
export type AssessmentType =
  | 'numerical_reasoning'
  | 'verbal_reasoning'
  | 'logical_reasoning'
  | 'inductive_reasoning'
  | 'deductive_reasoning'
  | 'situational_judgement'
  | 'personality'
  | 'pymetrics'
  | 'games_based'
  | 'coding'
  | 'technical_test'
  | 'case_study'
  | 'written_exercise'
  | 'hirevue'
  | 'video_interview'
  | 'phone_interview'
  | 'assessment_centre'
  | 'superday'
  | 'other'

export type EligibleUniversityYear =
  | 'first_year'
  | 'second_year'
  | 'penultimate_year'
  | 'final_year'
  | 'masters'
  | 'phd'
  | 'graduate'
  | 'other'
  | 'unknown'

/**
 * Document/answer requirement state. `undefined` (old records) MUST be
 * treated as `unknown` — never as `no`. See `resolveDocRequirement`.
 */
export type DocumentRequirement = 'yes' | 'no' | 'optional' | 'unknown'

export type ApplicationQuestionRequirement = 'yes' | 'no' | 'unknown'

export type WorkAuthorization =
  | 'sponsorship_available'
  | 'sponsorship_not_available'
  | 'existing_authorization_required'
  | 'unclear'
  | 'not_applicable'

export type Priority = 'high' | 'medium' | 'low'

export type RecommendedTiming =
  | 'immediately'
  | 'within_3_days'
  | 'within_1_week'
  | 'before_deadline'
  | 'unknown'

export type LanguageNeed = 'required' | 'preferred' | 'optional' | 'unknown'

export interface LanguageRequirement {
  language: string
  requirement: LanguageNeed
  proficiency?: string
}

export type ApplicationAvailability =
  | 'not_yet_open'
  | 'open'
  | 'closing_soon'
  | 'rolling'
  | 'closed'
  | 'unknown'

export type Specialization =
  | 'investment_banking'
  | 'private_equity'
  | 'venture_capital'
  | 'asset_management'
  | 'sales_trading'
  | 'equity_research'
  | 'dcm'
  | 'ecm'
  | 'corporate_finance'
  | 'manda'
  | 'transaction_services'
  | 'private_credit'
  | 'quantitative_finance'
  | 'risk'
  | 'consulting'
  | 'corporate_development'
  | 'real_estate'
  | 'leveraged_finance'
  | 'restructuring'
  | 'coverage'
  | 'financial_institutions'
  | 'industrials'
  | 'consumer_retail'
  | 'healthcare'
  | 'technology_media_telecom'
  | 'energy'
  | 'infrastructure'
  | 'financial_sponsors'
  | 'sales'
  | 'trading'
  | 'structuring'
  | 'fixed_income'
  | 'equities'
  | 'commodities'
  | 'fx'
  | 'credit'
  | 'rates'
  | 'derivatives'
  | 'credit_research'
  | 'quantitative_research'
  | 'quantitative_trading'
  | 'portfolio_management'
  | 'other'

export type Source =
  | 'company_website'
  | 'linkedin'
  | 'fyntraq'
  | 'trackr'
  | 'jobortunity'
  | 'indeed'
  | 'efinancialcareers'
  | 'bright_network'
  | 'handshake'
  | 'referral'
  | 'university_portal'
  | 'recruiter'
  | 'other'

export type RequirementType =
  | 'cv'
  | 'cover_letter'
  | 'essay'
  | 'personal_statement'
  | 'transcript'
  | 'university_transcript'
  | 'degree_certificate'
  | 'references'
  | 'recommendation_letter'
  | 'portfolio'
  | 'writing_sample'
  | 'motivation_letter'
  | 'video_interview'
  | 'online_assessment'
  | 'numerical_test'
  | 'logical_reasoning_test'
  | 'verbal_reasoning_test'
  | 'situational_judgement_test'
  | 'coding_test'
  | 'case_study'
  | 'presentation'
  | 'additional_questions'
  | 'diversity_questions'
  | 'work_authorization'
  | 'visa_information'
  | 'other'

export type RequirementStatus =
  | 'not_required'
  | 'required'
  | 'in_progress'
  | 'completed'
  | 'submitted'

export type DocumentType =
  | 'cv'
  | 'cover_letter'
  | 'transcript'
  | 'essay'
  | 'personal_statement'
  | 'writing_sample'
  | 'portfolio'
  | 'other'

export type DeadlineUrgency =
  | 'overdue'
  | 'due_today'
  | 'due_tomorrow'
  | 'due_this_week'
  | 'due_later'
  | 'rolling'
  | 'no_deadline'
  | 'closed'

export type ViewMode = 'table' | 'kanban' | 'calendar' | 'timeline'

export interface Company {
  id: string
  name: string
  logo?: string
  companyType: CompanyType
  industry?: string
  website?: string
  careersPage?: string
  offices: string[]
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Requirement {
  id: string
  applicationId: string
  type: RequirementType
  name: string
  status: RequirementStatus
  dueDate?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface DocumentRecord {
  id: string
  applicationId?: string
  companyId?: string
  type: DocumentType
  name: string
  version: string
  fileUrl?: string
  fileData?: string
  fileType?: string
  fileName?: string
  notes?: string
  dateCreated: string
  lastUpdated: string
}

export interface Contact {
  id: string
  applicationId?: string
  companyId?: string
  name: string
  position?: string
  company?: string
  email?: string
  linkedinUrl?: string
  relationship?: string
  dateContacted?: string
  lastContact?: string
  notes?: string
}

export interface Task {
  id: string
  applicationId?: string
  title: string
  dueDate?: string
  completed: boolean
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Tag {
  id: string
  name: string
  color?: string
}

export interface Application {
  id: string
  companyId?: string
  companyName: string
  companyType?: CompanyType
  companyWebsite?: string
  companyCareersPage?: string
  companyLogo?: string
  industry?: string
  country?: string
  city?: string
  office?: string
  companyNotes?: string

  jobTitle: string
  division?: string
  /** Canonical structured divisions. Legacy `division` is preserved; see `getDivisions`. */
  divisions?: Division[]
  team?: string
  specialization?: Specialization
  /** Canonical structured specializations. Legacy `specialization` is preserved; see `getSpecializations`. */
  specializations?: Specialization[]
  specificTeam?: string
  languages?: string[]
  /** Canonical structured languages. Legacy string entries normalize to `requirement: 'unknown'`. */
  languageRequirements?: LanguageRequirement[]
  targetGraduationYears?: number[]
  eligibleUniversityYears?: EligibleUniversityYear[]
  eligibilityRequirements?: string
  workAuthorization?: WorkAuthorization
  visaNotes?: string
  roleType: RoleType
  employmentType?: EmploymentType
  location?: string
  workArrangement?: WorkArrangement
  startDate?: string
  endDate?: string
  duration?: string
  recruitmentCycle?: string

  openingDate?: string
  deadline?: string
  deadlineType: DeadlineType
  timingNotes?: string
  applicationDate?: string
  interviewDate?: string
  offerDeadline?: string
  closingDate?: string

  status: ApplicationStatus
  source?: Source
  sourceUrl?: string
  applicationUrl?: string
  jobUrl?: string
  companyUrl?: string

  notes?: string
  followUpDate?: string
  priority?: Priority
  recommendedTiming?: RecommendedTiming
  nextAction?: string
  nextActionDate?: string
  lastChecked?: string
  dateInformationVerified?: string
  cvRequired?: DocumentRequirement
  coverLetterRequired?: DocumentRequirement
  transcriptRequired?: DocumentRequirement
  referencesRequired?: DocumentRequirement
  applicationQuestions?: ApplicationQuestionRequirement
  requirementsNotes?: string
  assessments?: AssessmentType[]
  assessmentNotes?: string
  applicationProcess?: string
  interviewProcess?: string
  expectedInterviewTimeline?: string
  archived: boolean
  isDemo?: boolean
  tagIds: string[]

  createdAt: string
  updatedAt: string
}

export interface SavedView {
  id: string
  name: string
  filters: ApplicationFilters
  createdAt: string
}

export interface ApplicationFilters {
  search: string
  statuses: ApplicationStatus[]
  companyTypes: CompanyType[]
  roleTypes: RoleType[]
  divisions: Division[]
  specializations: Specialization[]
  assessments: AssessmentType[]
  eligibleUniversityYears: EligibleUniversityYear[]
  targetGraduationYears: number[]
  workAuthorizations: WorkAuthorization[]
  workModes: WorkArrangement[]
  priorities: Priority[]
  cvRequired: DocumentRequirement[]
  coverLetterRequired: DocumentRequirement[]
  transcriptRequired: DocumentRequirement[]
  deadlineTypes: DeadlineType[]
  cycles: string[]
  countries: string[]
  cities: string[]
  sources: Source[]
  tags: string[]
  languages: string[]
  requirementTypes: RequirementType[]
  hasInterview: boolean | null
  hasOffer: boolean | null
  rollingDeadline: boolean | null
  deadlineWithinDays: number | null
  openingDateFrom?: string
  openingDateTo?: string
  deadlineFrom?: string
  deadlineTo?: string
  startDateFrom?: string
  startDateTo?: string
  applicationDateFrom?: string
  applicationDateTo?: string
  showArchived: boolean
}

export type SortField =
  | 'deadline'
  | 'openingDate'
  | 'applicationDate'
  | 'companyName'
  | 'jobTitle'
  | 'status'
  | 'location'
  | 'startDate'
  | 'priority'
  | 'nextActionDate'
  | 'updatedAt'

export interface SortState {
  field: SortField
  direction: 'asc' | 'desc'
}

export interface DashboardStats {
  total: number
  thisWeek: number
  thisMonth: number
  open: number
  interviews: number
  offers: number
  rejections: number
  upcomingDeadlines: number
  responseRate: number
  interviewRate: number
  offerRate: number
  byStatus: Record<string, number>
  byDivision: Record<string, number>
  byCompany: Record<string, number>
  byCountry: Record<string, number>
  byMonth: Record<string, number>
  avgDaysToInterview: number | null
  avgDaysToOutcome: number | null
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}
