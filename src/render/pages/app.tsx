import React from 'react'
import { Route, Routes } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import Dashboard from './Dashboard'
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
import { Permission } from '../types/permissions'

const App: React.FC = () => {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route
          path="/info-blog"
          element={
            <ProtectedRoute permissions={[Permission.USE_INFO_POSTING]}>
              <InfoBlog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/coupang-blog"
          element={
            <ProtectedRoute permissions={[Permission.USE_COUPANG_PARTNERS]}>
              <CoupangBlog />
            </ProtectedRoute>
          }
        />
        <Route path="/license" element={<LicensePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/common" element={<CommonSettings />} />
        <Route path="/settings/blogger" element={<BloggerSettings />} />
        <Route
          path="/settings/tistory"
          element={
            <ProtectedRoute permissions={[Permission.PUBLISH_TISTORY]}>
              <TistorySettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/tistory/account"
          element={
            <ProtectedRoute permissions={[Permission.PUBLISH_TISTORY]}>
              <TistorySettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/wordpress"
          element={
            <ProtectedRoute permissions={[Permission.PUBLISH_WORDPRESS]}>
              <WordPressSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/wordpress/account"
          element={
            <ProtectedRoute permissions={[Permission.PUBLISH_WORDPRESS]}>
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
            <ProtectedRoute permissions={[Permission.USE_COUPANG_PARTNERS]}>
              <CoupangPartnersSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/blogger/google"
          element={
            <ProtectedRoute permissions={[Permission.PUBLISH_GOOGLE_BLOGGER]}>
              <GoogleBlogSettings />
            </ProtectedRoute>
          }
        />
        <Route path="/settings/blogger/image" element={<ImageSettings />} />
      </Routes>
    </AppLayout>
  )
}

export default App
