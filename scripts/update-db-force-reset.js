import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// package.json에서 버전 정보 읽기
function getCurrentVersion() {
  try {
    const packageJsonPath = path.join(__dirname, '../package.json')
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8')
    const packageJson = JSON.parse(packageJsonContent)
    return packageJson.version
  } catch (error) {
    console.error('버전 정보를 읽을 수 없습니다:', error)
    return '0.0.0'
  }
}

// 설정 파일 경로
function getConfigPath() {
  const userDataPath = process.cwd() // 개발 환경에서는 현재 디렉토리
  return path.join(userDataPath, 'db-force-reset.json')
}

// 현재 설정 읽기
function readConfig() {
  const configPath = getConfigPath()
  try {
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf8')
      return JSON.parse(configContent)
    }
  } catch (error) {
    console.error('설정 파일 읽기 오류:', error)
  }

  // 기본 설정 반환
  return {
    version: getCurrentVersion(),
    forceReset: false
  }
}

// 설정 저장
function saveConfig(config) {
  const configPath = getConfigPath()
  try {
    const configDir = path.dirname(configPath)
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    console.log(`설정이 저장되었습니다: ${configPath}`)
  } catch (error) {
    console.error('설정 파일 저장 오류:', error)
  }
}

// 메인 함수
function main() {
  const args = process.argv.slice(2)
  
  // 환경변수에서 설정 읽기 (배포 시 사용)
  const envForceReset = process.env.DB_FORCE_RESET
  const envVersion = process.env.APP_VERSION
  
  if (args.length === 0 && !envForceReset) {
    console.log('사용법: node update-db-force-reset.js <forceReset>')
    console.log('  forceReset: true 또는 false')
    console.log('')
    console.log('환경변수 사용:')
    console.log('  DB_FORCE_RESET=true node update-db-force-reset.js')
    console.log('  DB_FORCE_RESET=false APP_VERSION=1.4.6 node update-db-force-reset.js')
    console.log('')
    console.log('Git 관리 모드 (기본):')
    console.log('  node update-db-force-reset.js  # Git의 db-force-reset.json 기반으로 버전만 업데이트')
    console.log('')
    console.log('예시:')
    console.log('  node update-db-force-reset.js true   # 강제 초기화 활성화')
    console.log('  node update-db-force-reset.js false  # 강제 초기화 비활성화')
    return
  }

  const currentVersion = envVersion || getCurrentVersion()
  
  if (args.length === 0 && !envForceReset) {
    // Git 관리 모드: 기존 설정 유지하고 버전만 업데이트
    console.log('=== Git 관리 모드: 버전 업데이트 ===')
    console.log(`현재 버전: ${currentVersion}`)
    
    const config = readConfig()
    const originalForceReset = config.forceReset
    
    config.version = currentVersion
    saveConfig(config)
    
    console.log(`설정이 업데이트되었습니다 (forceReset: ${originalForceReset} 유지):`)
    console.log(JSON.stringify(config, null, 2))
    return
  }

  // 명령행 인자나 환경변수로 설정 변경
  const forceReset = envForceReset ? envForceReset.toLowerCase() === 'true' : args[0].toLowerCase() === 'true'
  
  console.log('=== DB 강제 초기화 설정 업데이트 ===')
  console.log(`현재 버전: ${currentVersion}`)
  console.log(`강제 초기화: ${forceReset}`)
  console.log(`환경변수 사용: ${!!envForceReset}`)
  
  const config = readConfig()
  config.forceReset = forceReset
  config.version = currentVersion
  
  saveConfig(config)
  
  console.log('설정이 업데이트되었습니다:')
  console.log(JSON.stringify(config, null, 2))
}

main() 