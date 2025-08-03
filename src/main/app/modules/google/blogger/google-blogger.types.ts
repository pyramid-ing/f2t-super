export interface BloggerOptions {
  blogId?: string
  blogUrl?: string
  maxResults?: number
  pageToken?: string
  status?: 'live' | 'draft' | 'scheduled'
}

// 블로그 정보
export interface BloggerBlog {
  kind: 'blogger#blog'
  id: string
  name: string
  description?: string
  published: string
  updated: string
  url: string
  selfLink: string
  posts?: {
    totalItems: number
    selfLink: string
  }
  pages?: {
    totalItems: number
    selfLink: string
  }
  locale?: {
    language: string
    country?: string
    variant?: string
  }
}

// 블로그 목록 응답
export interface BloggerBlogListResponse {
  kind: 'blogger#blogList'
  items: BloggerBlog[]
}

// 포스트 정보 및 생성 응답
export interface BloggerPost {
  kind: 'blogger#post'
  id: string
  blog: { id: string }
  published: string
  updated: string
  url: string
  selfLink: string
  title: string
  content: string
  author: {
    id: string
    displayName: string
    url?: string
    image?: { url: string }
  }
  labels?: string[]
  replies?: {
    totalItems: string
    selfLink: string
  }
}

// 포스트 목록 응답
export interface BloggerPostListResponse {
  kind: 'blogger#postList'
  nextPageToken?: string
  items: BloggerPost[]
}

// 포스트 검색 응답 (동일)
export type BloggerPostSearchResponse = BloggerPostListResponse

// 포스트 생성 요청
export interface BloggerPostRequest {
  blogId: string
  bloggerBlogId: string
  googleOAuthId: string
  title: string
  content: string
  labels?: string[]
}

// 포스트 생성 응답 (BloggerPost와 동일)
export type BloggerPostResponse = BloggerPost

// 단일 포스트 조회 응답 (BloggerPost와 동일)
export type BloggerSingleResponse = BloggerPost

// 댓글 정보
export interface BloggerComment {
  kind: 'blogger#comment'
  id: string
  post: { id: string }
  blog: { id: string }
  published: string
  updated: string
  selfLink: string
  content: string
  author: {
    id: string
    displayName: string
    url?: string
    image?: { url: string }
  }
}

// 댓글 목록 응답
export interface BloggerCommentListResponse {
  kind: 'blogger#commentList'
  nextPageToken?: string
  prevPageToken?: string
  items: BloggerComment[]
}

// 댓글 단일 응답
export type BloggerCommentResponse = BloggerComment

// 페이지 정보
export interface BloggerPage {
  kind: 'blogger#page'
  id: string
  blog: { id: string }
  published: string
  updated: string
  url: string
  selfLink: string
  title: string
  content: string
  author: {
    id: string
    displayName: string
    url?: string
    image?: { url: string }
  }
}

// 페이지 목록 응답
export interface BloggerPageListResponse {
  kind: 'blogger#pageList'
  items: BloggerPage[]
}

// 페이지 단일 응답
export type BloggerPageResponse = BloggerPage

// 사용자 정보
export interface BloggerUser {
  kind: 'blogger#user'
  id: string
  selfLink: string
  blogs: {
    selfLink: string
  }
}
