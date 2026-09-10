export type ApplicationStatus =
  | 'interested'
  | 'to_apply'
  | 'preparing'
  | 'applied'
  | 'online_assessment'
  | 'first_interview'
  | 'second_interview'
  | 'final_interview'
  | 'assessment_centre'
  | 'superday'
  | 'offer'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'ghosted'
  | 'closed'

export type DeadlineType = 'specific' | 'rolling' | 'until_filled' | 'unknown'

export type RoleType =
  | 'summer_internship'
  | 'off_cycle_internship'
  | 'spring_week'
  | 'graduate_programme'
  | 'full_time'
  | 'part_time'
  | 'working_student'
  | 'apprenticeship'
  | 'placement'
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
  | 'hedge_fund'
  | 'corporate'
  | 'consulting'
  | 'big4'
  | 'fintech'
  | 'other'

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
  | 'other'

export type Source =
  | 'company_website'
  | 'linkedin'
  | 'fyntraq'
  | 'trackr'
  | 'jobortunity'
  | 'indeed'
  | 'efinancialcareers'
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
  team?: string
  specialization?: Specialization
  languages?: string[]
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
  divisions: string[]
  specializations: Specialization[]
  countries: string[]
  cities: string[]
  sources: Source[]
  tags: string[]
  languages: string[]
  requirementTypes: RequirementType[]
  hasInterview: boolean | null
  hasOffer: boolean | null
  rollingDeadline: boolean | null
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
