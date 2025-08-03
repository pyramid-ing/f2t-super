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
  position: absolute;
  bottom: 12px;
  left: 12px;
  right: 12px;
  padding: 16px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
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

  .ant-btn-primary {
    background: rgba(82, 196, 26, 0.2);
    border-color: rgba(82, 196, 26, 0.4);
    color: #95de64;

    &:hover {
      background: rgba(82, 196, 26, 0.3);
      border-color: rgba(82, 196, 26, 0.6);
      color: #b7eb8f;
    }

    &:focus {
      background: rgba(82, 196, 26, 0.3);
      border-color: rgba(82, 196, 26, 0.6);
      color: #b7eb8f;
    }
  }

  .ant-btn-loading {
    opacity: 0.7;
  }
`

const AppSidebar: React.FC = () => {
  const location = useLocation()
  const [appVersion, setAppVersion] = useState<string>('...')

  useEffect(() => {
    const getVersion = async () => {
      try {
        const version = await window.electronAPI.getAppVersion()
        setAppVersion(version)
      } catch (error) {
        console.error('앱 버전을 가져오는데 실패했습니다:', error)
        setAppVersion('Unknown')
      }
    }

    getVersion()
  }, [])

  const getSelectedKey = () => {
    if (location.pathname === '/') return 'dashboard'
    if (location.pathname === '/info-blog') return 'info-blog'
    if (location.pathname === '/coupang-blog') return 'coupang-blog'
    if (location.pathname === '/settings') return 'settings'
    if (location.pathname === '/settings/common') return 'common-settings'
    if (location.pathname === '/settings/blogger') return 'blogger-settings'
    if (location.pathname === '/settings/tistory') return 'tistory-settings'
    if (location.pathname === '/settings/wordpress') return 'wordpress-settings'
    if (location.pathname === '/settings/ai') return 'ai-settings'
    if (location.pathname === '/settings/ad') return 'ad-settings'
    if (location.pathname === '/settings/link') return 'link-settings'
    if (location.pathname === '/settings/coupang-partners') return 'coupang-partners-settings'
    if (location.pathname === '/settings/blogger/google') return 'google-blog-settings'
    if (location.pathname === '/settings/blogger/image') return 'image-settings'
    return 'dashboard'
  }

  const getOpenKeys = () => {
    const openKeys: string[] = []

    if (location.pathname.startsWith('/settings')) {
      openKeys.push('settings')
    }

    return openKeys
  }

  return (
    <Sider width={260} style={{ position: 'relative' }}>
      <Logo>블로그 스팟 포스팅 봇</Logo>
      <Menu
        theme="dark"
        selectedKeys={[getSelectedKey()]}
        defaultOpenKeys={getOpenKeys()}
        mode="inline"
        style={{ paddingBottom: '80px' }}
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
            ],
          },
        ]}
      />
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
