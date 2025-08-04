import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { CoupangCrawlerService } from '@main/app/modules/coupang-crawler/coupang-crawler.service'
import { CoupangPartnersService } from '@main/app/modules/coupang-partners/coupang-partners.service'
import { TistoryService } from '@main/app/modules/tistory/tistory.service'
import { WordPressService } from '@main/app/modules/wordpress/wordpress.service'
import { GoogleBloggerService } from '@main/app/modules/google/blogger/google-blogger.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { JobTargetType } from '@render/api'
import { CoupangBlogJob } from '@prisma/client'
import { CoupangBlogPostJobStatus, CoupangBlogPostJobResponse } from './coupang-blog-post-job.types'
import { CreateCoupangBlogPostJobDto } from './dto/create-coupang-blog-post-job.dto'
import { UpdateCoupangBlogPostJobDto } from './dto/update-coupang-blog-post-job.dto'
import { BlogOutline } from '@main/app/modules/ai/ai.interface'
import { CoupangProductData as CoupangCrawlerProductData } from '@main/app/modules/coupang-crawler/coupang-crawler.types'
import { CoupangAffiliateLink } from '@main/app/modules/coupang-partners/coupang-partners.types'
import { Type } from '@google/genai'
import { GeminiService } from '@main/app/modules/ai/gemini.service'
import { JobStatus } from '@main/app/modules/job/job.types'

interface CoupangProductData {
  title: string
  price: string
  originalUrl: string
  affiliateUrl: string
  images: string[]
  reviews: any[]
}

interface BlogPostData {
  accountId: number | string
  platform: string
  title: string
  thumbnailUrl: string
  contentHtml: string
  tags: string[]
}

export interface CoupangBlogPost {
  sections: {
    html: string // HTML content for each section
  }[]
}

@Injectable()
export class CoupangBlogPostJobService {
  private readonly logger = new Logger(CoupangBlogPostJobService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly coupangCrawler: CoupangCrawlerService,
    private readonly coupangPartners: CoupangPartnersService,
    private readonly geminiService: GeminiService,
    private readonly tistoryService: TistoryService,
    private readonly wordpressService: WordPressService,
    private readonly googleBloggerService: GoogleBloggerService,
  ) {}

  /**
   * 1. 쿠팡 크롤링
   */
  private async crawlCoupangProduct(coupangUrl: string): Promise<CoupangProductData> {
    try {
      this.logger.log(`쿠팡 상품 크롤링 시작: ${coupangUrl}`)

      // 쿠팡 상품 정보 크롤링
      const crawledData: CoupangCrawlerProductData = await this.coupangCrawler.crawlProductInfo(coupangUrl)

      this.logger.log(`쿠팡 상품 크롤링 완료: ${crawledData.title}`)

      return {
        title: crawledData.title,
        price: crawledData.price.toString(),
        originalUrl: coupangUrl,
        affiliateUrl: '', // 2단계에서 설정
        images: crawledData.images,
        reviews: crawledData.reviews ? Object.values(crawledData.reviews).flat() : [],
      }
    } catch (error) {
      this.logger.error('쿠팡 크롤링 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
        message: '쿠팡 상품 정보 크롤링에 실패했습니다.',
      })
    }
  }

  /**
   * 2. 쿠팡 어필리에이트 생성
   */
  private async createAffiliateLink(coupangUrl: string): Promise<string> {
    try {
      this.logger.log(`쿠팡 어필리에이트 링크 생성 시작: ${coupangUrl}`)

      // 쿠팡 어필리에이트 링크 생성
      const affiliateData: CoupangAffiliateLink = await this.coupangPartners.createAffiliateLink(coupangUrl)

      this.logger.log(`쿠팡 어필리에이트 링크 생성 완료: ${affiliateData.shortenUrl}`)

      return affiliateData.shortenUrl
    } catch (error) {
      this.logger.error('쿠팡 어필리에이트 링크 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
        message: '쿠팡 어필리에이트 링크 생성에 실패했습니다.',
      })
    }
  }

  /**
   * 계정 설정 확인 및 플랫폼 결정
   */
  private validateBlogAccount(coupangBlogJob: CoupangBlogJob): {
    platform: 'tistory' | 'wordpress' | 'google'
    accountId: number | string
  } {
    if (coupangBlogJob.tistoryAccountId) {
      return {
        platform: 'tistory',
        accountId: coupangBlogJob.tistoryAccountId,
      }
    } else if (coupangBlogJob.wordpressAccountId) {
      return {
        platform: 'wordpress',
        accountId: coupangBlogJob.wordpressAccountId,
      }
    } else if (coupangBlogJob.bloggerAccountId) {
      return {
        platform: 'google',
        accountId: coupangBlogJob.bloggerAccountId,
      }
    } else {
      throw new CustomHttpException(ErrorCode.BLOG_ACCOUNT_NOT_CONFIGURED, {
        message: '블로그 계정이 설정되지 않았습니다. 티스토리, 워드프레스 또는 블로그스팟 계정을 먼저 설정해주세요.',
      })
    }
  }

  /**
   * 3. 이미지 업로드 (티스토리, 워드프레스, 구글 블로거)
   */
  private async uploadImages(
    imagePaths: string[],
    platform: 'tistory' | 'wordpress' | 'google',
    accountId: number | string,
  ): Promise<string[]> {
    try {
      this.logger.log(`${platform} 이미지 업로드 시작: ${imagePaths.length}개`)

      let uploadedImages: string[] = []

      switch (platform) {
        case 'tistory':
          uploadedImages = await this.tistoryService.uploadImages(accountId as number, imagePaths)
          break
        case 'wordpress':
          // 워드프레스는 개별 업로드
          for (const imagePath of imagePaths) {
            try {
              const uploadedUrl = await this.wordpressService.uploadImage(accountId as number, imagePath)
              uploadedImages.push(uploadedUrl)
              this.logger.log(`이미지 업로드 완료: ${imagePath} → ${uploadedUrl}`)
            } catch (error) {
              this.logger.error(`이미지 업로드 실패 (${imagePath}):`, error)
              throw new CustomHttpException(ErrorCode.IMAGE_UPLOAD_FAILED, {
                message: `${platform} 이미지 업로드에 실패했습니다. 이미지 URL: ${imagePath}`,
              })
            }
          }
          break
        case 'google':
          // Google Blogger는 이미지 업로드를 지원하지 않으므로 원본 URL 사용
          uploadedImages = imagePaths
          break
        default:
          throw new Error(`지원하지 않는 플랫폼: ${platform}`)
      }

      this.logger.log(`${platform} 이미지 업로드 완료: ${uploadedImages.length}개`)
      return uploadedImages
    } catch (error) {
      this.logger.error(`${platform} 이미지 업로드 실패:`, error)
      throw new CustomHttpException(ErrorCode.IMAGE_UPLOAD_FAILED, {
        message: `${platform} 이미지 업로드에 실패했습니다.`,
      })
    }
  }

  /**
   * 썸네일 생성 (메인 이미지 + 위에 글자 생성)
   */
  private async generateThumbnail(productData: CoupangProductData): Promise<string> {
    try {
      this.logger.log('썸네일 생성 시작')

      // 메인 이미지 URL (첫 번째 이미지 사용)
      const mainImageUrl = productData.images[0] || ''

      if (!mainImageUrl) {
        throw new Error('썸네일 생성에 사용할 이미지가 없습니다.')
      }

      // 썸네일 텍스트 설정
      const thumbnailText = `${productData.title} 리뷰`

      // 썸네일 생성 (실제 구현에서는 이미지 처리 라이브러리 사용)
      // 여기서는 임시로 메인 이미지 URL을 반환
      const thumbnailUrl = mainImageUrl

      this.logger.log('썸네일 생성 완료')
      return thumbnailUrl
    } catch (error) {
      this.logger.error('썸네일 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
        message: '썸네일 생성에 실패했습니다.',
      })
    }
  }

  /**
   * 태그 생성 (10개의 해당상품과 관련된 태그 생성)
   */
  private async generateTags(productData: CoupangProductData): Promise<string[]> {
    try {
      this.logger.log('태그 생성 시작')

      // 상품 제목에서 키워드 추출하여 태그 생성
      const title = productData.title.toLowerCase()
      const keywords = title.split(/[\s\-_]+/).filter(word => word.length > 1)

      // 기본 태그 목록
      const baseTags = ['리뷰', '상품', '구매', '추천']

      // 상품 관련 태그 생성
      const productTags = keywords.slice(0, 6) // 최대 6개 키워드

      // 전체 태그 조합 (최대 10개)
      const allTags = [...baseTags, ...productTags].slice(0, 10)

      this.logger.log(`태그 생성 완료: ${allTags.length}개`)
      return allTags
    } catch (error) {
      this.logger.error('태그 생성 실패:', error)
      // 태그 생성 실패 시 기본 태그 반환
      return ['리뷰', '상품', '구매']
    }
  }

  /**
   * HTML 조합 함수 (생성된 이미지, 썸네일, 내용 등을 조합해서 html(string)로 만들기)
   */
  private combineHtmlContent({
    platform,
    sections,
    affiliateUrl,
    thumbnailUrl,
    imageUrls,
  }: {
    sections: string[]
    imageUrls: string[]
    thumbnailUrl: string
    affiliateUrl: string
    platform: 'tistory' | 'wordpress' | 'google'
  }): string {
    this.logger.log('HTML 조합 시작')

    // 썸네일 이미지 HTML
    const thumbnailHtml =
      platform === 'tistory'
        ? `
        <div class="thumbnail-container" style="text-align: center; margin-bottom: 20px;">
          ${thumbnailUrl}
        </div>
      `
        : `
        <div class="thumbnail-container" style="text-align: center; margin-bottom: 20px;">
          <img src="${thumbnailUrl}" alt="썸네일" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" />
        </div>
      `

    // 상품 이미지들 HTML
    const productImagesHtml = imageUrls
      .map((imageUrl, index) => {
        if (platform === 'tistory') {
          // 티스토리의 경우 placeholder 형식 사용
          return `
              <div class="product-image" style="margin: 10px 0;">
                ${imageUrl}
              </div>
            `
        } else {
          // 워드프레스, 구글 블로거의 경우 img 태그 사용
          return `
              <div class="product-image" style="margin: 10px 0;">
                <img src="${imageUrl}" alt="상품 이미지 ${index + 1}" style="max-width: 100%; height: auto; border-radius: 4px;" />
              </div>
            `
        }
      })
      .join('')

    // 구매 링크 HTML
    const purchaseLinkHtml = affiliateUrl
      ? `
        <div class="purchase-link" style="text-align: center; margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
          <a href="${affiliateUrl}" target="_blank" style="display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
            🛒 구매하기
          </a>
        </div>
      `
      : ''

    const combinedSectionHtml = sections
      .map(
        section => `
      <div class="section" style="margin: 20px 0;">
          ${section}
          
          ${productImagesHtml}
          ${purchaseLinkHtml}
      </div>
    `,
      )
      .join('')

    // 전체 HTML 조합
    const combinedHtml = `
        <div class="blog-post">
          ${thumbnailHtml}
          
          ${combinedSectionHtml}
        </div>
      `

    this.logger.log('HTML 조합 완료')
    return combinedHtml
  }

  /**
   * 4. 블로그 아웃라인 생성 (제목 포함)
   */
  private async generateBlogOutline(productData: CoupangProductData): Promise<BlogOutline> {
    try {
      this.logger.log('블로그 아웃라인 생성 시작')

      const gemini = await this.geminiService.getGemini()

      const prompt = `
너는 블로그 포스팅을 위한 목차(JSON 아웃라인)를 작성하는 역할이야.

다음 기준을 지켜서 JSON 배열로 만들어줘:

1. 전체 구성은 총 6~10개 항목으로 구성하며, 아래 3개는 반드시 포함해야 해:
   - 서론 (항상 첫 번째)
   - FAQ (중간~끝 쯤)
   - 마무리 및 팁 (마지막)

2. 각 항목은 아래 형식을 따른다:

{
  "index": 1,         // 순서
  "title": "h2 제목",        // 섹션의 메인 제목
  "summary": "- 부제목1\\n- 부제목2...",   // 해당 h2에서 다룰 소주제(h3 느낌)
  "length": "예상 글자 수"                // 예: "300자", "500자"
}
title은 h2 제목처럼 간결하고 명확하게,
summary는 h3 제목들처럼 3~5개의 소주제를 리스트(-) 형식으로 나열해줘.

예를 들면:

"title": "예약 가능한 방법"

"summary": "- 공식 홈페이지\\n- 네이버 예약\\n- 전화 예약"

서론, FAQ, 마무리 및 팁 항목은 다음 기준을 따라 작성해:

서론: 주제 필요성 설명 + 핵심 키워드 포함

FAQ: 실제 검색자가 자주 궁금해할 질문형 소제목들

마무리: 요약 + CTA 느낌의 제목들

입력으로 주어진 title과 description을 기반으로 작성해줘.

출력은 반드시 JSON 배열 형태로만 해줘.

예시 입력:

title: SPEEDY 15W 고속 무선충전 거치대

이제 해당 입력에 맞는 JSON 목차를 위 구조로 생성해줘.
### ✅ 예상 결과 예시
title
[
  {
    "index": 1,
    "title": "서론",
    "summary": "- 혜자 도시락이란?\\n- 왜 가성비 도시락이 인기일까?\\n- 이 글에서 다룰 핵심 내용은?",
    "length": "200자"
  },
  {
    "index": 2,
    "title": "혜자 도시락의 뜻과 유래",
    "summary": "- '혜자'라는 단어의 유래\\n- 누가 처음 사용했나?\\n- 왜 지금도 통용되는가?",
    "length": "300자"
  },
  {
    "index": 3,
    "title": "편의점별 인기 도시락",
    "summary": "- CU: 혜자 제육 도시락\\n- GS25: 직화불고기 도시락\\n- 세븐일레븐: 고기듬뿍 스테이크\\n- 이마트24: 훈제오리\\n- 홈플러스: 왕돈까스 도시락",
    "length": "300자"
  },
  {
    "index": 4,
    "title": "혜자 도시락 고르는 팁",
    "summary": "- 구성 살펴보기\\n- 영양 밸런스 고려\\n- 조리 편의성 체크\\n- 가격 대비 만족도\\n- 리뷰 참고",
    "length": "400자"
  },
  {
    "index": 5,
    "title": "FAQ",
    "summary": "- 혜자 도시락은 어디서 사나요?\\n- 유통기한은 얼마나 되나요?\\n- 전자레인지 조리 시간은?\\n- 할인 구매 가능한가요?\\n- 칼로리는 얼마나 되나요?",
    "length": "300자"
  },
  {
    "index": 6,
    "title": "마무리 및 팁",
    "summary": "- 지금 먹기 좋은 도시락은?\\n- 상황별 추천 도시락\\n- 자취생, 직장인 필수템\\n- 구매 팁 한 줄 요약",
    "length": "300자"
  }
]
        [user]
        - 제목: ${productData.title}
`

      const resp = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          maxOutputTokens: 60000,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    index: { type: Type.NUMBER },
                    title: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    length: { type: Type.STRING },
                  },
                  required: ['index', 'title', 'summary', 'length'],
                },
                minItems: 1,
              },
            },
            required: ['sections'],
          },
        },
      })
      this.logger.log('블로그 아웃라인 생성 완료')

      return JSON.parse(resp.text) as BlogOutline
    } catch (error) {
      this.logger.error('블로그 아웃라인 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
        message: '블로그 아웃라인 생성에 실패했습니다.',
      })
    }
  }

  /**
   * 5. 블로그 포스트 생성
   */
  private async generateBlogPostSections(blogOutline: BlogOutline): Promise<CoupangBlogPost> {
    this.logger.log(`Gemini로 블로그 콘텐츠 생성 시작`)

    const prompt = `
당신은 블로그 콘텐츠 제작 전문가입니다. 아래 입력을 바탕으로 사람이 직접 쓴 것처럼 자연스럽고 정보 밀도 높은 블로그 콘텐츠를 HTML로 구성해주세요.

## 입력 데이터 형식
sections: {
  index: number // 섹션 순서
  title: string // 제목
  summary: string // 이 섹션에서 설명할 요약 설명
  length: string // 예상 글자 수 (예: '300자')
}[]

---

## 작성 스타일 및 톤

1. **톤 & 문체**: 따뜻하고 신뢰감 있는 말투, 독자에게 말을 걸 듯 설명
2. **대상 독자**: 일반인 또는 정보 탐색 중인 소비자
3. **문체 특징**:
   - 단순 요약이 아닌 설명 + 예시 + 감성 표현을 섞은 서술
   - 상황을 상상하게 만드는 문장 활용
   - 말투는 '합니다' 또는 '해요' 형태의 부드러운 경어 사용

---

## HTML 구조 규칙

### 1. 제목 구조
- \`<h2>\`: 주요 섹션 제목
- \`<h3>\`: 하위 주제 구분
- \`<h4>\`: 구체적 사례나 예시 설명

### 2. 본문 구성
- \`<p>\`: 기본 문단
- \`<ul>\`, \`<ol>\` + \`<li>\`: 항목 설명
- \`<blockquote>\`: 사용자 후기나 감성적 사례 강조
- \`<strong>\`: 핵심 키워드 강조
- \`<em>\`: 부연 설명 또는 주의사항
- \`<hr>\`: 명확한 섹션 구분

### 3. 표 사용
- 만약 비교, 절차, 요금, 구분 등 구조적 정보가 있을 경우:
  - \`<table>\`, \`<thead>\`, \`<tbody>\`, \`<tr>\`, \`<th>\`, \`<td>\` 활용
  - 표 내용은 깔끔하게 2~4열로 구성

### 4. 서론
첫번째 section인 서론은 h2 제목을 포함하지마. 도입부이므로 필요없어.

### 5. FAQ 구성
- FAQ 섹션이 존재할 경우: 
!반드시 아래와같은 마크업 스타일을 지켜!
<h2>자주 묻는 질문</h2>
<div class="chat-screen">
  <!-- 질문 -->
  <div class="chat-line chat-left">
    <div class="chat-bubble chat-bubble-left">
      <h3>Q. 배송은 얼마나 걸리나요?</h3>
    </div>
  </div>

  <!-- 답변 -->
  <div class="chat-line chat-right">
    <div class="chat-bubble chat-bubble-right">
      <p>A. 보통 <strong>1~3일 이내</strong>에 도착합니다. <em>도서산간 지역은 추가로 1~2일이 소요될 수 있어요.</em></p>
    </div>
  </div>
</div>

### 기타 주의사항
글자 수는 length보다 더 풍부하게 써도 괜찮음 (예: 250자 → 약 400~500자)

최종적으로 모든 섹션 글자수가 반드시 2000자 이상 되도록 작성해줘.

각 section은 다음 형식의 JSON으로 출력
{ "html": "<h2>제목</h2><p>내용...</p>" }
sections 배열로 응답
---

## 예시 입력
[
  {
    "index": 0,
    "title": "요양보호사란?",
    "summary": "요양보호사라는 직업이 어떤 일을 하는지, 왜 필요한지 설명",
    "length": "300자"
  }
]
예시 출력
{
  "sections": [
    {
      "html": <p>학교장터, 매일같이 씨름하는 학교의 구매 시스템이죠. 편리하고 효율적이라고는 하는데, 왠지 모르게 업무 시간이 자꾸만 늘어나는 기분이 드시나요? 매번 비슷한 품목을 검색하고, 서류를 뒤적이며, 혹시라도 중요한 공고를 놓칠까 봐 마음 졸이셨을지도 모릅니다. 학교장터가 여러분의 <strong>귀한 업무 시간</strong>을 잡아먹는 주범처럼 느껴진다면, 이 글이 바로 그 해답이 되어줄 거예요.</p><p>많은 분들이 학교장터를 단순히 물품을 구매하는 시스템으로만 생각하시지만, 사실 그 안에는 <strong>업무 효율을 극대화할 수 있는 숨겨진 비법</strong>들이 가득합니다. 오늘 저는 여러분이 학교장터를 정말 ‘효율적으로’ 쓸 수 있도록 돕는 4가지 핵심 비법을 공개할 거예요. 이 비법들을 익히신다면, 지루하고 반복적인 학교장터 업무를 단축하고, 더욱 중요한 일에 집중할 수 있게 될 겁니다. 이제부터 학교장터를 스마트하게 활용하는 방법을 저와 함께 파헤쳐 볼까요?</p>"
    },
    {
      "html": "<h2>남들은 모르는 학교장터의 숨겨진 비효율성</h2><p>학교장터를 사용하는 많은 담당자분들이 공통적으로 겪는 어려움이 있어요. 바로 <strong>반복적인 수작업의 비효율성</strong>입니다. 매번 구매 품목이 같아도 일일이 검색해야 하고, 과거에 어떤 업체와 계약했는지 찾아보려면 여러 메뉴를 헤매야 하죠. 심지어 중요한 입찰 공고나 알림을 놓쳐서 곤란한 상황에 처하는 경우도 비일비재합니다. “이게 정말 최선일까?”라는 의문이 들 때가 한두 번이 아니었을 거예요.</p><p>학교장터는 방대한 정보를 담고 있는 강력한 플랫폼이지만, 그만큼 <strong>숨겨진 기능들이 너무 많아</strong> 오히려 사용자들이 본연의 효율성을 제대로 누리지 못하는 경우가 많습니다. 마치 보물을 숨겨놓은 지도처럼, 어디에 무엇이 있는지 알지 못하면 그 가치를 온전히 발휘할 수 없죠. 숨겨진 기능들은 단순히 편의성을 넘어, 여러분의 업무 프로세스를 혁신적으로 단축시키고, 실수를 줄이며, 더 나아가 전략적인 의사결정을 돕는 중요한 도구들이에요. 이제부터 그 베일 속에 가려져 있던 비효율성의 장막을 걷어내고, 학교장터의 진짜 힘을 보여드릴게요.</p><hr>"
    }
  ]
}
[콘텐츠 아웃라인:]
${JSON.stringify(blogOutline)}`

    const gemini = await this.geminiService.getGemini()

    const resp = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: 60000,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  html: { type: Type.STRING },
                },
                required: ['html'],
              },
              minItems: 1,
            },
          },
          required: ['sections'],
          propertyOrdering: ['sections'],
        },
      },
    })

    return JSON.parse(resp.text) as CoupangBlogPost
  }

  /**
   * 6. 지정된 블로그로 발행 (티스토리, 워드프레스)
   */
  private async publishToBlog(blogPostData: BlogPostData): Promise<{ url: string }> {
    try {
      this.logger.log(`${blogPostData.platform} 블로그 발행 시작`)

      let publishedUrl: string

      switch (blogPostData.platform) {
        case 'tistory':
          const tistoryResult = await this.tistoryService.publishPost(blogPostData.accountId as number, {
            title: blogPostData.title,
            contentHtml: blogPostData.contentHtml,
            keywords: [blogPostData.title],
            postVisibility: 'public',
          })
          publishedUrl = tistoryResult.url
          break
        case 'wordpress':
          const wordpressResult = await this.wordpressService.publishPost(blogPostData.accountId as number, {
            title: blogPostData.title,
            content: blogPostData.contentHtml,
            featuredImage: blogPostData.thumbnailUrl,
          })
          publishedUrl = wordpressResult.url
          break
        case 'google':
          // Google Blogger는 bloggerBlogId와 oauthId가 필요하므로 accountId를 bloggerAccountId로 사용
          const bloggerAccount = await this.prisma.bloggerAccount.findUnique({
            where: { id: blogPostData.accountId as number },
            include: { oauth: true },
          })

          if (!bloggerAccount) {
            throw new Error(`Blogger 계정을 찾을 수 없습니다: ${blogPostData.accountId}`)
          }

          const googleResult = await this.googleBloggerService.publish({
            title: blogPostData.title,
            content: blogPostData.contentHtml,
            bloggerBlogId: bloggerAccount.bloggerBlogId,
            oauthId: bloggerAccount.googleOauthId,
          })
          publishedUrl = googleResult.url
          break
        default:
          throw new Error(`지원하지 않는 플랫폼: ${blogPostData.platform}`)
      }

      this.logger.log(`${blogPostData.platform} 블로그 발행 완료: ${publishedUrl}`)
      return { url: publishedUrl }
    } catch (error) {
      this.logger.error(`${blogPostData.platform} 블로그 발행 실패:`, error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
        message: `${blogPostData.platform} 블로그 발행에 실패했습니다.`,
      })
    }
  }

  /**
   * 쿠팡 블로그 포스트 작업 처리 (메인 프로세스)
   */
  public async processCoupangPostJob(jobId: string): Promise<{ resultUrl?: string; resultMsg: string }> {
    try {
      this.logger.log(`쿠팡 블로그 포스트 작업 시작: ${jobId}`)

      // 작업 정보 조회
      const coupangBlogJob = await this.prisma.coupangBlogJob.findUnique({
        where: { jobId },
        include: {
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      if (!coupangBlogJob) {
        throw new Error('CoupangBlogJob not found')
      }

      // 쿠팡 크롤링
      // const productData = await this.crawlCoupangProduct(coupangBlogJob.coupangUrl)
      //
      // // 쿠팡 어필리에이트 생성
      // const affiliateUrl = await this.createAffiliateLink(coupangBlogJob.coupangUrl)
      // productData.affiliateUrl = affiliateUrl
      const productData = {
        title: '디지지 듀얼코일 PD 15W 고속 무선 충전거치대 + C타입 고속케이블 1.2m 세트',
        price: '13850',
        originalUrl:
          'https://www.coupang.com/vp/products/7495778120?itemId=19610591986&searchId=feed-51a8c88cdd1f43399590c571fec145d6-view_together_ads-P7762543485&vendorItemId=86717569386&sourceType=SDP_ADS&clickEventId=b4d44fc0-70e5-11f0-aa8c-af42e30466bc',
        affiliateUrl: 'https://link.coupang.com/a/cIAsFE',
        images: [
          '/Users/ironkim/WebstormProjects/f2t-super/static/temp/coupang-images/image_0.webp',
          '/Users/ironkim/WebstormProjects/f2t-super/static/temp/coupang-images/image_1.webp',
          '/Users/ironkim/WebstormProjects/f2t-super/static/temp/coupang-images/image_2.webp',
        ],
        reviews: [
          {
            author: '김*수',
            date: '2023.09.05',
            content:
              '항상 충전기를 사용하다 보면 충전 연결잭 부분이 접촉 불량으로 충전이 되었다 안되었다 하는 증상으로 매번 계속 새제품을 구입해서 바꾸게 되었는데 지금 현재 쓰는 것도 몇 번째 바꾼 건지 모르겠네요. 그래서 이번에는 고속무선 충전 거치대로 구입을 하게 되었어요.아무래도 충전잭을 꼽고 빼고 하다 보면 선을 많이 만지다 보니 잘 고장나게 되는 거 같은데 거치대 같은 경우에는 그냥 간편하게 핸드폰만 올려 주면 충전이 되니 연결잭 접촉불량으로 고장날 일은 절대 없을 것 같더라구요. 디지지 듀얼코일 고속 무선 충전 거치대 같은 경우는 c타입 고속 케이블도 함께 들어있는 구성이라서 가격대비 아주 괜찮은 제품 같아요. 듀얼 코일로 충전되는 범위가 넓어서 가로 세로 어느 방향으로 거치해도 안정적이고 빠른 충전이 되네요.스마트 기기와의 최대 10mm 무선신호로 실리콘이나 하드케이스도 문제 없이 충전이 가능하고, 정말 짧은 시간에 빠른 충전이 가능해서 너무 만족하며 사용하고 있어요. 충전 중에는 파란불로 표시 되고 완료되면 초록색 불로 바뀌니 충전 완료된 것도 알 수 있고 정말 똑똑한 충전 거치대인 것 같아요. 현재 거실에 놔두고 사용 중인데 안방에도 하나 더 구입해서 놔두고 사용하려구요. 정말 편하고도 실용적인 충전기입니다. 가격대비 굿!',
            rating: 5,
          },
          {
            author: '쿠팡실구매자',
            date: '2023.09.07',
            content:
              '안녕하세요. 권아삭입니다.✅ 구매동기전에는 고속 저속만 구분해서 구매했는데 막상 충전기 쓰다보니 컴퓨터 작업하는 책상에서는 모니터 하단에 무선충전기 세워서 쓰는게 진짜 편하더라구요. 연락이나 알림오는것도 한번에 볼 수 있고 아마 한번쓰시면 절대 다른 타입 못쓰실꺼에요.✅ 디자인어댑터는 없지만 케이블2개와 본체가 들어있는데 디자인이 굉장히 심플하고 군더더기 없어서 어느곳에나 잘 어울릴 제품이에요.✅ 충전후기세로 가로 모두 다 충전되는 타입이라 유투브같은거 틀어놓으면서 충전하기도 용이한 제품이에요. 사진처럼 충전 잘 됩니다 ㅎㅎ감사합니다!!',
            rating: 5,
          },
          {
            author: '우영희',
            date: '2023.09.04',
            content:
              '컴퓨터랑 핸드폰이랑 같이 작업하는 일을 하고있어서 무선 충전기가 필요했고 거치대처럼 받쳐지는게 필요햇는데딱 적합한 상품을 발견한것 같아요~아이폰, 갤럭시 두개모두 사용중인데 두개다 충전이 잘됩니다. 컴퓨터 선 근처에 코드가 남는게 없어서 충전을 매번 다른곳에서 햇는데 본체에 케이블선 연결하니 너무나 편합니다! 아 박스가 .. 검정색이라서 잘못 왔나 했더니 박스사진만 블랙이고 안에는 화이트 맞았습니다^^',
            rating: 5,
          },
          {
            author: '콩고물고물',
            date: '2023.09.09',
            content:
              '핸드폰 게임도하고 영상도 보고 노트북 작업하면서도 많이 쓰는데 손도 아프고 충전하기도 정신없는데 그냥 세워주면 끝이라 편하네요. 잠시 자리비울때도 코드 뺄필요없이 폰만 슥 들고 나가면끝. 별다른 설치없이 usb로 충전가능하다는게 매력적이에요. 제 폰 기종s23인데 충전이 잘되었고 홍미노트는 충전이 안되더라구요. 호환되는거 잘확인하고사시면 삶의질 상승템되실거에요!',
            rating: 5,
          },
          {
            author: '두다두',
            date: '2023.09.03',
            content:
              '충전빠르고 좋네요 무선충전은 느리다고 생각해서 안썼는데 고속충전이라서 너무 편해요. 가로,세로 어떻게 거치를 해도 다 충전이 가능해서 어디서든 편하게 사용할 수 있네요.가장 좋은건 폰과의 거리가 최대 10mm의 무선신호로도 충전이 가능해서 두꺼운 케이스나 그립톡이 있어도 문제없이 안정적으로 무선충전이 가능하다는 거에요^^  굿굿~  너무 잘 쓰고 있어요',
            rating: 5,
          },
        ],
      }

      // 계정 설정 확인 및 플랫폼 결정
      const { platform, accountId } = this.validateBlogAccount(coupangBlogJob)

      // 썸네일 생성
      const localThumbnailUrl = await this.generateThumbnail(productData)
      const uploadedThumbnailImage = (await this.uploadImages([localThumbnailUrl], platform, accountId))[0]

      // 이미지 업로드
      const uploadedImages = await this.uploadImages(productData.images, platform, accountId)

      // 태그 생성
      const tags = await this.generateTags(productData)

      // 블로그 아웃라인 생성 (제목 포함)
      const blogOutline = await this.generateBlogOutline(productData)

      // 블로그 포스트 생성
      const blogPost = await this.generateBlogPostSections(blogOutline)

      // 조합합수(생성된 이미지, 썸네일, 내용 등을 조합해서 html(string)로 만들기)
      const contentHtml = this.combineHtmlContent({
        platform,
        sections: blogPost.sections.map(s => s.html),
        thumbnailUrl: uploadedThumbnailImage,
        imageUrls: uploadedImages,
        affiliateUrl: productData.affiliateUrl,
      })

      // 지정된 블로그로 발행 (AI가 생성한 제목 사용)
      const publishResult = await this.publishToBlog({
        accountId,
        platform,
        title: blogOutline.title,
        thumbnailUrl: uploadedThumbnailImage,
        contentHtml,
        tags,
      })
      const publishedUrl = publishResult.url

      this.logger.log(`쿠팡 블로그 포스트 작업 완료: ${jobId}`)

      return {
        resultUrl: publishedUrl,
        resultMsg: '쿠팡 리뷰 포스트가 성공적으로 발행되었습니다.',
      }
    } catch (error) {
      this.logger.error(`쿠팡 블로그 포스트 작업 실패: ${jobId}`, error)
      throw error
    }
  }

  /**
   * CoupangBlogPostJob 생성
   */
  async createCoupangBlogPostJob(jobData: CreateCoupangBlogPostJobDto): Promise<CoupangBlogPostJobResponse> {
    try {
      // Job 생성
      const job = await this.prisma.job.create({
        data: {
          targetType: JobTargetType.COUPANG_REVIEW_POSTING,
          subject: jobData.subject,
          desc: jobData.desc,
          status: JobStatus.PENDING,
          priority: jobData.priority || 1,
          scheduledAt: jobData.scheduledAt ? new Date(jobData.scheduledAt) : new Date(),
        },
      })

      // CoupangBlogJob 생성
      const coupangBlogJob = await this.prisma.coupangBlogJob.create({
        data: {
          coupangUrl: jobData.coupangUrl,
          coupangAffiliateLink: jobData.coupangAffiliateLink,
          title: jobData.title,
          content: jobData.content,
          labels: jobData.labels,
          tags: jobData.tags,
          category: jobData.category,
          status: CoupangBlogPostJobStatus.DRAFT,
          jobId: job.id,
          bloggerAccountId: jobData.bloggerAccountId,
          wordpressAccountId: jobData.wordpressAccountId,
          tistoryAccountId: jobData.tistoryAccountId,
        },
        include: {
          job: true,
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      return this.mapToResponseDto(coupangBlogJob)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED)
    }
  }

  /**
   * CoupangBlogPostJob 조회
   */
  async getCoupangBlogPostJob(jobId: string): Promise<CoupangBlogPostJobResponse | null> {
    try {
      const coupangBlogJob = await this.prisma.coupangBlogJob.findUnique({
        where: { jobId },
        include: {
          job: true,
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      if (!coupangBlogJob) {
        return null
      }

      return this.mapToResponseDto(coupangBlogJob)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  /**
   * CoupangBlogPostJob 목록 조회
   */
  async getCoupangBlogPostJobs(status?: CoupangBlogPostJobStatus): Promise<CoupangBlogPostJobResponse[]> {
    try {
      const where: any = {}
      if (status) {
        where.status = status
      }

      const coupangBlogJobs = await this.prisma.coupangBlogJob.findMany({
        where,
        include: {
          job: true,
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return coupangBlogJobs.map(coupangBlogJob => this.mapToResponseDto(coupangBlogJob))
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 목록 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  /**
   * CoupangBlogPostJob 업데이트
   */
  async updateCoupangBlogPostJob(
    jobId: string,
    updateData: UpdateCoupangBlogPostJobDto,
  ): Promise<CoupangBlogPostJobResponse> {
    try {
      const coupangBlogJob = await this.prisma.coupangBlogJob.update({
        where: { jobId },
        data: {
          title: updateData.title,
          content: updateData.content,
          labels: updateData.labels,
          tags: updateData.tags,
          category: updateData.category,
          status: updateData.status,
          resultUrl: updateData.resultUrl,
          coupangAffiliateLink: updateData.coupangAffiliateLink,
          publishedAt: updateData.status === CoupangBlogPostJobStatus.PUBLISHED ? new Date() : null,
        },
        include: {
          job: true,
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      return this.mapToResponseDto(coupangBlogJob)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 업데이트 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_UPDATE_FAILED)
    }
  }

  /**
   * CoupangBlogPostJob 삭제
   */
  async deleteCoupangBlogPostJob(jobId: string): Promise<void> {
    try {
      await this.prisma.coupangBlogJob.delete({
        where: { jobId },
      })
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 삭제 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_DELETE_FAILED)
    }
  }

  /**
   * CoupangBlogPostJob 상태 업데이트
   */
  async updateCoupangBlogPostJobStatus(
    jobId: string,
    status: CoupangBlogPostJobStatus,
  ): Promise<CoupangBlogPostJobResponse> {
    try {
      const updateData: any = { status }

      if (status === CoupangBlogPostJobStatus.PUBLISHED) {
        updateData.publishedAt = new Date()
      }

      const coupangBlogJob = await this.prisma.coupangBlogJob.update({
        where: { jobId },
        data: updateData,
        include: {
          job: true,
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      return this.mapToResponseDto(coupangBlogJob)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 상태 업데이트 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_UPDATE_FAILED)
    }
  }

  /**
   * 응답 DTO로 매핑
   */
  private mapToResponseDto(coupangBlogJob: CoupangBlogJob): CoupangBlogPostJobResponse {
    return {
      id: coupangBlogJob.id,
      coupangUrl: coupangBlogJob.coupangUrl,
      coupangAffiliateLink: coupangBlogJob.coupangAffiliateLink,
      title: coupangBlogJob.title,
      content: coupangBlogJob.content,
      labels: coupangBlogJob.labels,
      tags: coupangBlogJob.tags,
      category: coupangBlogJob.category,
      resultUrl: coupangBlogJob.resultUrl,
      status: coupangBlogJob.status as CoupangBlogPostJobStatus,
      publishedAt: coupangBlogJob.publishedAt?.toISOString(),
      createdAt: coupangBlogJob.createdAt.toISOString(),
      updatedAt: coupangBlogJob.updatedAt.toISOString(),
      jobId: coupangBlogJob.jobId,
      bloggerAccountId: coupangBlogJob.bloggerAccountId,
      wordpressAccountId: coupangBlogJob.wordpressAccountId,
      tistoryAccountId: coupangBlogJob.tistoryAccountId,
    }
  }
}
