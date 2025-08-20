export type ExtraKey =
  | 'content'
  | 'dailyRate'
  | 'benefitDetail'
  | 'cancellationDetail'
  | 'promotionDetail'
  | 'rateDetail'
  | 'surchargeDetail'
  | 'taxDetail'
  | 'metaSearch'

export interface AgodaSearchCriteria {
  propertyIds: number[]
  checkIn: string
  checkOut: string
  rooms: number
  adults: number
  children: number
  childrenAges?: number[]
  ratePlan?: 'cug' | 'CUG'
  language: string
  currency: string
  userCountry?: string
  platform?: 'Desktop' | 'MobileApp' | 'MobileWeb'
}

export interface AgodaSearchFeatures {
  extra?: ExtraKey[]
  ratesPerProperty?: number
}

export interface AgodaSearchRequestBody {
  criteria: AgodaSearchCriteria
  features?: AgodaSearchFeatures
}

export interface AgodaSearchResponse {
  searchId: number | string
  properties: Array<{
    propertyId: number
    propertyName?: string
    translatedPropertyName?: string
    rooms: Array<{
      roomId: number
      blockId: string
      blockIdBackup?: string
      parentRoomId: number
      roomName?: string
      parentRoomName?: string
      translatedRoomName?: string
      ratePlanId: number
      freeWifi?: boolean
      freeBreakfast: boolean
      freeCancellation: boolean
      remainingRooms?: number
      normalBedding?: number
      extraBeds?: number
      paymentModel?: 'Agency' | 'Merchant' | 'MerchantCommission'
      totalPayment?: {
        exclusive: number
        inclusive: number
        tax: number
        fees: number
        estimatedCommission?: number
      }
      rate: {
        currency: string
        exclusive: number
        inclusive: number
        tax: number
        fees: number
        method: 'PRPN' | 'PB' | 'PN' | 'PR'
      }
      perRoomPerNightRate?: {
        currency: string
        exclusive: number
        inclusive: number
        tax: number
        fees: number
      }
      dailyRate?: Array<{
        date: string
        exclusive: number
        inclusive: number
        tax: number
        fees: number
        method: 'PN'
      }>
      promotionDetail?: {
        promotionId: number
        codeEligible: boolean
        description: string
        savingAmount: number
      }
      surcharges?: Array<{
        id: number
        method: 'PB'
        charge: 'Mandatory' | 'Excluded'
        margin: 'y' | 'n'
        name: string
        rate: {
          currency: string
          exclusive: number
          inclusive: number
          tax: number
          fees: number
        }
      }>
      taxBreakdown?: Array<{
        id: string
        typeValue: 'Tax' | 'Fee'
        taxDescription: string
        translatedTaxDescription?: string
        method:
          | 'PAPB'
          | 'PAPD'
          | 'PAPN'
          | 'PB'
          | 'PCPB'
          | 'PCPD'
          | 'PCPN'
          | 'PGPB'
          | 'PGPD'
          | 'PGPN'
          | 'PN'
          | 'PRPB'
          | 'PRPN'
        base: 'M' | 'N'
        taxable: 'Y' | 'N'
        percent: number
        currency: string
        amount: number
      }>
      cancellationPolicy?: {
        code: string
        cancellationText: string
        translatedCancellationText?: string
        parameter?: Array<{ days: number; charge: 'N' | 'P'; value: number }>
        date?: Array<{
          before?: string
          onward?: string
          rate: { exclusive: number; inclusive: number; tax: number; fees: number }
        }>
      }
      benefits?: Array<{
        id: number
        benefitName: string
        translatedBenefitName?: string
      }>
      landingUrl?: string
      freeCancellationDate?: string
      payAtHotel?: boolean
    }>
  }>
}
