import React from 'react'
import { Route, Routes } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import Dashboard from './Dashboard'
import SettingsPage from './Settings'
import InfoBlog from './InfoBlog'
import CoupangBlog from './CoupangBlog'
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

const App: React.FC = () => {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/info-blog" element={<InfoBlog />} />
        <Route path="/coupang-blog" element={<CoupangBlog />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/common" element={<CommonSettings />} />
        <Route path="/settings/blogger" element={<BloggerSettings />} />
        <Route path="/settings/tistory" element={<TistorySettings />} />
        <Route path="/settings/wordpress" element={<WordPressSettings />} />
        <Route path="/settings/ai" element={<AISettings />} />
        <Route path="/settings/ad" element={<AdSettings />} />
        <Route path="/settings/link" element={<LinkSettings />} />
        <Route path="/settings/coupang-partners" element={<CoupangPartnersSettings />} />
        <Route path="/settings/blogger/google" element={<GoogleBlogSettings />} />
        <Route path="/settings/blogger/image" element={<ImageSettings />} />
      </Routes>
    </AppLayout>
  )
}

export default App
