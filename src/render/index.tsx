import { StyleProvider } from '@ant-design/cssinjs'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter as Router } from 'react-router-dom'
import { RecoilRoot } from 'recoil'
import App from './pages/app'
import SettingsInitializer from './components/SettingsInitializer'
import PermissionsInitializer from './components/PermissionsInitializer'
import './styles/global.css'

const container = document.getElementById('root') as HTMLElement
const root = createRoot(container)
root.render(
  <StyleProvider hashPriority="high">
    <RecoilRoot>
      <SettingsInitializer>
        <PermissionsInitializer>
          <Router>
            <App />
          </Router>
        </PermissionsInitializer>
      </SettingsInitializer>
    </RecoilRoot>
  </StyleProvider>,
)
