import React from 'react'
import { Route, Routes } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import Home from './Home'
import SettingsPage from './Settings'
import InfoBlog from './InfoBlog'
import CoupangBlog from './CoupangBlog'
import LicensePage from './License'
import CommonSettings from './settings/CommonSettings'
import BloggerSettings from './settings/BloggerSettings'
import TistorySettings from './settings/TistorySettings'
import WordPressSettings from './settings/WordPressSettings'
import AISettings from './settings/AISettings'
import AdSettings from './settings/AdSettings'
import LinkSettings from './settings/LinkSettings'
import CoupangPartnersSettings from './settings/CoupangPartnersSettings'
import GoogleBlogSettings from './settings/GoogleBlogSettings'
import ImageSettings from './settings/ImageSettings'
import ProtectedRoute from '../components/shared/ProtectedRoute'
import ImageGeneration from './settings/ImageGeneration'
import PermissionOverlay from '../components/shared/PermissionOverlay'
import { Permission } from '../types/permissions'

const App: React.FC = () => {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/info-blog"
          element={
            <ProtectedRoute
              permissions={[Permission.USE_INFO_POSTING]}
              fallbackComponent={
                <div style={{ position: 'relative' }}>
                  <InfoBlog />
                  <PermissionOverlay
                    requiredPermissions={[Permission.USE_INFO_POSTING]}
                    featureName="정보 블로그"
                    features={['정보성 블로그 포스트 작성', 'AI를 활용한 콘텐츠 생성', '자동 포스팅 기능']}
                  />
                </div>
              }
            >
              <InfoBlog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/coupang-blog"
          element={
            <ProtectedRoute
              permissions={[Permission.USE_COUPANG_PARTNERS]}
              fallbackComponent={
                <div style={{ position: 'relative' }}>
                  <CoupangBlog />
                  <PermissionOverlay
                    requiredPermissions={[Permission.USE_COUPANG_PARTNERS]}
                    featureName="쿠팡 블로그"
                    features={['쿠팡 파트너스 링크 생성', '상품 리뷰 자동 작성', '수익 창출 기능']}
                  />
                </div>
              }
            >
              <CoupangBlog />
            </ProtectedRoute>
          }
        />
        <Route path="/license" element={<LicensePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/common" element={<CommonSettings />} />
        <Route path="/settings/image" element={<ImageGeneration />} />
        <Route path="/settings/blogger" element={<BloggerSettings />} />
        <Route
          path="/settings/tistory"
          element={
            <ProtectedRoute
              permissions={[Permission.PUBLISH_TISTORY]}
              fallbackComponent={
                <div style={{ position: 'relative' }}>
                  <TistorySettings />
                  <PermissionOverlay
                    requiredPermissions={[Permission.PUBLISH_TISTORY]}
                    featureName="티스토리 발행"
                    features={['티스토리 블로그에 자동 포스팅', '티스토리 계정 관리', '티스토리 API 연동']}
                  />
                </div>
              }
            >
              <TistorySettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/tistory/account"
          element={
            <ProtectedRoute
              permissions={[Permission.PUBLISH_TISTORY]}
              fallbackComponent={
                <div style={{ position: 'relative' }}>
                  <TistorySettings />
                  <PermissionOverlay
                    requiredPermissions={[Permission.PUBLISH_TISTORY]}
                    featureName="티스토리 발행"
                    features={['티스토리 블로그에 자동 포스팅', '티스토리 계정 관리', '티스토리 API 연동']}
                  />
                </div>
              }
            >
              <TistorySettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/wordpress"
          element={
            <ProtectedRoute
              permissions={[Permission.PUBLISH_WORDPRESS]}
              fallbackComponent={
                <div style={{ position: 'relative' }}>
                  <WordPressSettings />
                  <PermissionOverlay
                    requiredPermissions={[Permission.PUBLISH_WORDPRESS]}
                    featureName="워드프레스 발행"
                    features={['워드프레스 사이트에 자동 포스팅', '워드프레스 계정 관리', '워드프레스 API 연동']}
                  />
                </div>
              }
            >
              <WordPressSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/wordpress/account"
          element={
            <ProtectedRoute
              permissions={[Permission.PUBLISH_WORDPRESS]}
              fallbackComponent={
                <div style={{ position: 'relative' }}>
                  <WordPressSettings />
                  <PermissionOverlay
                    requiredPermissions={[Permission.PUBLISH_WORDPRESS]}
                    featureName="워드프레스 발행"
                    features={['워드프레스 사이트에 자동 포스팅', '워드프레스 계정 관리', '워드프레스 API 연동']}
                  />
                </div>
              }
            >
              <WordPressSettings />
            </ProtectedRoute>
          }
        />
        <Route path="/settings/ai" element={<AISettings />} />
        <Route path="/settings/ad" element={<AdSettings />} />
        <Route path="/settings/link" element={<LinkSettings />} />
        <Route
          path="/settings/coupang-partners"
          element={
            <ProtectedRoute
              permissions={[Permission.USE_COUPANG_PARTNERS]}
              fallbackComponent={
                <div style={{ position: 'relative' }}>
                  <CoupangPartnersSettings />
                  <PermissionOverlay
                    requiredPermissions={[Permission.USE_COUPANG_PARTNERS]}
                    featureName="쿠팡 파트너스"
                    features={['쿠팡 파트너스 링크 생성', '상품 리뷰 자동 작성', '수익 창출 기능']}
                  />
                </div>
              }
            >
              <CoupangPartnersSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/blogger/google"
          element={
            <ProtectedRoute
              permissions={[Permission.PUBLISH_GOOGLE_BLOGGER]}
              fallbackComponent={
                <div style={{ position: 'relative' }}>
                  <GoogleBlogSettings />
                  <PermissionOverlay
                    requiredPermissions={[Permission.PUBLISH_GOOGLE_BLOGGER]}
                    featureName="구글 블로그 발행"
                    features={['구글 블로그에 자동 포스팅', '구글 블로그 계정 관리', '구글 블로그 API 연동']}
                  />
                </div>
              }
            >
              <GoogleBlogSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/blogger/image"
          element={
            <ProtectedRoute
              permissions={[Permission.PUBLISH_GOOGLE_BLOGGER]}
              fallbackComponent={
                <div style={{ position: 'relative' }}>
                  <ImageSettings />
                  <PermissionOverlay
                    requiredPermissions={[Permission.PUBLISH_GOOGLE_BLOGGER]}
                    featureName="구글 블로그 발행"
                    features={['구글 블로그에 자동 포스팅', '구글 블로그 계정 관리', '구글 블로그 API 연동']}
                  />
                </div>
              }
            >
              <ImageSettings />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AppLayout>
  )
}

export default App
