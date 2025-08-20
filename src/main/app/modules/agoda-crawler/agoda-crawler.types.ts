// 공용 리뷰 타입 (아고다)
export interface AgodaReview {
  content: string
  rating: number
  author: string
  date: string
}

// 아고다 상품 데이터 (블로그 포스팅에 사용)
export interface AgodaProductData {
  title: string
  price: number
  originalUrl: string
  affiliateUrl: string
  originImageUrls: string[]
  images: string[]
  reviews: {
    positive: AgodaReview[]
  }
  url?: string
}

export interface AgodaCrawlerOptions {
  headless?: boolean
  timeout?: number
  userAgent?: string
  processImages?: boolean
}

export interface CoupangCrawlerError {
  code: string
  message: string
  details?: any
}

// Agoda 상세 페이지 리뷰 API 응답 타입
export interface AgodaReviewApiResponse {
  hasReviewsData: boolean
  pageSize: number
  hotelId: number
  hotelName: string
  additionalReviewProviders?: number[]
  recentReviewScores?: Array<{
    providerId: number
    recentReviewScores: number[]
    recentReviewScoresFormatted: string[]
  }>
  combinedReview?: {
    isShowCombinedRating: boolean
    score: {
      maxScore: number
      providerId: number
      reviewCommentsCount: number
      reviewCount: number
      score: number
      demographic: string
      formattedReviewCount: string
      formattedScore: string
      scoreText: string
    }
    providers: Array<{
      providerId: number
      logoUrl: string
      logoName: string
      logoAltText: string
    }>
    grades: Array<{
      id: string
      name: string
      score: number
      scoreText: string
      formattedScore: string
    }>
  }
  commentList: {
    reviewPageUrl: string
    currentPage: number
    hotelID: number
    pageSize: number
    selectedSortOption: number
    haveMoreThanOneComments: boolean
    isCrawlablePage: boolean
    isCurated: boolean
    isReviewPage: boolean
    shouldShowProminentLink: boolean
    pageNumberToPageUrl: Record<string, string>
    reviewsSortOptions: Record<string | number, string>
    comments: Array<{
      isHelpfulComment: boolean
      isReviewVoted: boolean
      isShowReviewResponse: boolean
      isShowReviewResponseTranslateButton: boolean
      isShowReviewTranslateButton: boolean
      helpfulVotes: number
      responseLanguageId: number
      unHelpfulVotes: number
      hotelReviewId: number
      providerId: number
      rating: number
      checkInDateMonthAndYear: string
      encryptedReviewData: string
      formattedRating: string
      formattedReviewDate: string
      formattedReviewHelpfulText: string
      ratingText: string
      responderName: string
      responseDateText: string
      responseTranslateSource: string
      reviewComments: string
      reviewNegatives: string
      reviewPositives: string
      reviewProviderLogo: string
      reviewProviderText: string
      reviewTitle: string
      translateSource: string
      translateTarget: string
      checkInDate?: string
      checkOutDate?: string
      reviewDate: string
      reviewerInfo: {
        countryName: string
        displayMemberName: string
        flagName: string
        reviewGroupName: string
        roomTypeName: string
        countryId: number
        lengthOfStay: number
        reviewGroupId: number
        roomTypeId: number
        reviewerReviewedCount: number
        isExpertReviewer: boolean
        isShowGlobalIcon: boolean
        isShowReviewedCount: boolean
      }
      originalTitle: string
      originalComment: string
      formattedResponseDate: string
    }>
    reviewFilterAndSort: Array<{
      providerId: number
      selectedSortingOption: number
      hasSelectedFilters: boolean
      showLanguageFilter: boolean
      showRoomTypeFilter: boolean
      hasCommentsMoreThanOnePage: boolean
      shouldShowReviewFilters: boolean
      sortings: Array<{ sortId: number; sortText: string }>
      filters: Array<{
        name: string
        filterItemsPerRow: number
        displayShowMore: boolean
        type: number
        filterItems: Array<{
          id: number
          key: string
          name: string
          count: number
          isSelected: boolean
        }>
      }>
    }>
    providerList: Array<{ id: number; isDefaultProvider: boolean; totalIndex: number }>
    provider: number
    searchReview: { searchKeyword: string }
  }
  // score/reviewTabs 등은 필요 시 확장
}
