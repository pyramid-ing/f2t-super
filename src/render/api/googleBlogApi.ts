import { api } from './apiClient'

export const googleBlogApi = {
  // Google 블로그 목록 조회
  getGoogleBlogList: () => api.get('/google-blog').then(res => res.data),

  // Google 블로그 조회
  getGoogleBlog: (id: string) => api.get(`/google-blog/${id}`).then(res => res.data),

  // Google 블로그 생성
  createGoogleBlog: (data: {
    oauthId: string
    bloggerBlogName: string
    bloggerBlogId: string
    name: string
    description?: string
    isDefault?: boolean
    defaultVisibility?: string
  }) => api.post('/google-blog', data).then(res => res.data),

  // Google 블로그 수정
  updateGoogleBlog: (
    id: string,
    data: {
      name?: string
      description?: string
      isDefault?: boolean
    },
  ) => api.put(`/google-blog/${id}`, data).then(res => res.data),

  // Google 블로그 삭제
  deleteGoogleBlog: (id: string) => api.delete(`/google-blog/${id}`).then(res => res.data),

  // 기본 Google 블로그 조회
  getDefaultGoogleBlog: () => api.get('/google-blog/default').then(res => res.data),

  // 특정 OAuth 계정의 기본 블로그 조회
  getDefaultGoogleBlogByOAuthId: (oauthId: string) =>
    api.get(`/google-blog/oauth/${oauthId}/default`).then(res => res.data),

  // Google OAuth 계정 목록 조회
  getGoogleOAuthList: () => api.get('/google-oauth/accounts').then(res => res.data),

  // Google Blogger API - 사용자 블로그 목록 조회 (기본 계정)
  getUserBlogs: () => api.get('/google-blogger/user/blogs').then(res => res.data),

  // Google Blogger API - 특정 OAuth 계정의 사용자 블로그 목록 조회
  getUserBlogsByOAuthId: (oauthId: string) => api.get(`/google-blogger/user/blogs/${oauthId}`).then(res => res.data),

  // Google Blogger 계정 목록 조회
  getBloggerAccounts: () => api.get('/google-blogger/accounts').then(res => res.data),
}
