import {
  HomeOutlined,
  SettingOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  GoogleOutlined,
  BookOutlined,
  PictureOutlined,
  LinkOutlined,
  RobotOutlined,
  DollarOutlined,
  ShopOutlined,
  KeyOutlined,
} from '@ant-design/icons'
import { Layout, Menu, Typography } from 'antd'
import React, { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import styled from 'styled-components'
import UpdateManager from '../components/UpdateManager'

const { Text } = Typography

const { Sider } = Layout

const Logo = styled.div`
  height: 32px;
  margin: 16px;
  background: rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  border-radius: 4px;
`

const UpdateSection = styled.div`
  position: relative;
  margin: 12px;
  padding: 16px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  flex-shrink: 0;
`

const VersionInfo = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`

const VersionLabel = styled.span`
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
`

const VersionBadge = styled.span`
  background: rgba(24, 144, 255, 0.2);
  color: #69c0ff;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
  border: 1px solid rgba(24, 144, 255, 0.3);
`

const UpdateButtonWrapper = styled.div`
  .ant-btn {
    width: 100%;
    height: 32px;
    background: rgba(24, 144, 255, 0.1);
    border: 1px solid rgba(24, 144, 255, 0.3);
    color: #69c0ff;
    font-size: 12px;
    font-weight: 500;

    &:hover {
      background: rgba(24, 144, 255, 0.2);
      border-color: rgba(24, 144, 255, 0.5);
      color: #91d5ff;
    }

    &:focus {
      background: rgba(24, 144, 255, 0.2);
      border-color: rgba(24, 144, 255, 0.5);
      color: #91d5ff;
    }

    .anticon {
      font-size: 12px;
    }
  }
`

const AppSidebar: React.FC = () => {
  const [appVersion, setAppVersion] = useState<string>('')
  const location = useLocation()

  useEffect(() => {
    const getVersion = async () => {
      try {
        const version = await window.electronAPI.getAppVersion()
        setAppVersion(version)
      } catch (error) {
        console.error('Failed to get app version:', error)
        setAppVersion('1.0.0')
      }
    }

    getVersion()
  }, [])

  const getSelectedKey = () => {
    const pathname = location.pathname
    if (pathname === '/') return 'dashboard'
    if (pathname === '/info-blog') return 'info-blog'
    if (pathname === '/coupang-blog') return 'coupang-blog'
    if (pathname === '/license') return 'license'
    if (pathname.startsWith('/settings')) return 'settings'
    return 'dashboard'
  }

  const getOpenKeys = () => {
    const pathname = location.pathname
    const openKeys: string[] = []

    if (pathname.startsWith('/settings')) {
      openKeys.push('settings')

      if (
        pathname.includes('/ai') ||
        pathname.includes('/ad') ||
        pathname.includes('/link') ||
        pathname.includes('/coupang-partners')
      ) {
        openKeys.push('common-settings')
      }
      if (pathname.includes('/blogger') || pathname.includes('/google')) {
        openKeys.push('blogger-settings')
      }
      if (pathname.includes('/tistory')) {
        openKeys.push('tistory-settings')
      }
      if (pathname.includes('/wordpress')) {
        openKeys.push('wordpress-settings')
      }
    }

    return openKeys
  }

  return (
    <Sider width={280} theme="dark" style={{ background: '#001529' }}>
      <Logo>F2T Super</Logo>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Menu
          theme="dark"
          selectedKeys={[getSelectedKey()]}
          defaultOpenKeys={getOpenKeys()}
          mode="inline"
          style={{ border: 'none', height: '100%' }}
          items={[
            {
              key: 'dashboard',
              icon: <HomeOutlined />,
              label: <NavLink to="/">대시보드</NavLink>,
            },
            {
              key: 'info-blog',
              icon: <FileTextOutlined />,
              label: <NavLink to="/info-blog">정보 블로그</NavLink>,
            },
            {
              key: 'coupang-blog',
              icon: <ShoppingOutlined />,
              label: <NavLink to="/coupang-blog">쿠팡 블로그</NavLink>,
            },
            {
              key: 'settings',
              icon: <SettingOutlined />,
              label: '설정',
              children: [
                {
                  key: 'common-settings',
                  icon: <SettingOutlined />,
                  label: '공통설정',
                  children: [
                    {
                      key: 'ai-settings',
                      icon: <RobotOutlined />,
                      label: <NavLink to="/settings/ai">AI</NavLink>,
                    },
                    {
                      key: 'ad-settings',
                      icon: <DollarOutlined />,
                      label: <NavLink to="/settings/ad">광고</NavLink>,
                    },
                    {
                      key: 'link-settings',
                      icon: <LinkOutlined />,
                      label: <NavLink to="/settings/link">링크</NavLink>,
                    },
                    {
                      key: 'coupang-partners-settings',
                      icon: <ShopOutlined />,
                      label: <NavLink to="/settings/coupang-partners">쿠팡 파트너스</NavLink>,
                    },
                  ],
                },
                {
                  key: 'blogger-settings',
                  icon: <GoogleOutlined />,
                  label: '블로그스팟 설정',
                  children: [
                    {
                      key: 'google-blog-settings',
                      icon: <GoogleOutlined />,
                      label: <NavLink to="/settings/blogger/google">구글 블로그</NavLink>,
                    },
                    {
                      key: 'image-settings',
                      icon: <PictureOutlined />,
                      label: <NavLink to="/settings/blogger/image">이미지 설정</NavLink>,
                    },
                  ],
                },
                {
                  key: 'tistory-settings',
                  icon: <BookOutlined />,
                  label: '티스토리 설정',
                  children: [
                    {
                      key: 'tistory-account',
                      icon: <BookOutlined />,
                      label: <NavLink to="/settings/tistory/account">티스토리 계정</NavLink>,
                    },
                  ],
                },
                {
                  key: 'wordpress-settings',
                  icon: <BookOutlined />,
                  label: '워드프레스 설정',
                  children: [
                    {
                      key: 'wordpress-account',
                      icon: <BookOutlined />,
                      label: <NavLink to="/settings/wordpress/account">워드프레스 계정</NavLink>,
                    },
                  ],
                },
                {
                  key: 'license-settings',
                  icon: <KeyOutlined />,
                  label: <NavLink to="/license">라이센스</NavLink>,
                },
              ],
            },
          ]}
        />
      </div>
      <UpdateSection>
        <VersionInfo>
          <VersionLabel>현재 버전</VersionLabel>
          <VersionBadge>v{appVersion}</VersionBadge>
        </VersionInfo>
        <UpdateButtonWrapper>
          <UpdateManager autoCheck={true} />
        </UpdateButtonWrapper>
      </UpdateSection>
    </Sider>
  )
}

export default AppSidebar
