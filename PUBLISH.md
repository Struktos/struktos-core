# NPM 발행 가이드

## 📋 발행 전 체크리스트

### 1. NPM 계정 확인
```bash
# NPM에 로그인되어 있는지 확인
npm whoami

# 로그인되어 있지 않다면
npm login
```

### 2. Organization 생성 (선택사항)
`@struktos` organization을 사용하려면 NPM에서 organization을 먼저 생성해야 합니다.

**옵션 A: Organization 사용**
- https://www.npmjs.com 에서 organization 생성
- 이름: `struktos` (또는 원하는 이름)
- package.json의 name을 organization에 맞게 수정

**옵션 B: Scoped Package로 개인 발행**
```json
// package.json
{
  "name": "@your-npm-username/struktos-core",
  // ...
}
```

**옵션 C: Unscoped Package로 발행**
```json
// package.json
{
  "name": "struktos-core",  // @ 없이
  // ...
}
```

### 3. 빌드 및 테스트
```bash
# TypeScript 컴파일
npm run build

# 빌드 결과 확인
ls -la dist/

# POC 테스트 (선택사항)
npm run poc
npm run poc:cancellation
npm run poc:cache
```

### 4. 패키지 내용 확인
```bash
# 발행될 파일 목록 확인
npm pack --dry-run

# 또는 실제로 tarball 생성해서 확인
npm pack
tar -tzf struktos-core-0.1.0.tgz
```

## 🚀 발행 절차

### 첫 발행 (v0.1.0)

```bash
# 1. 최종 빌드
npm run build

# 2. 버전 확인
cat package.json | grep version

# 3. 발행 (dry-run으로 먼저 테스트)
npm publish --dry-run

# 4. 실제 발행
npm publish

# scoped package (@struktos/core)의 경우 public으로 명시
npm publish --access public
```

### 버전 업데이트 후 발행

```bash
# Patch 버전 올리기 (0.1.0 → 0.1.1)
npm version patch

# Minor 버전 올리기 (0.1.0 → 0.2.0)
npm version minor

# Major 버전 올리기 (0.1.0 → 1.0.0)
npm version major

# 발행
npm publish --access public
```

## 📦 발행 후 확인

### 1. NPM 웹사이트에서 확인
```
https://www.npmjs.com/package/@struktos/core
```

### 2. 로컬에서 설치 테스트
```bash
# 새 디렉토리에서 테스트
mkdir test-install && cd test-install
npm init -y
npm install @struktos/core

# 사용 테스트
node -e "const { RequestContext } = require('@struktos/core'); console.log(RequestContext);"
```

### 3. TypeScript 타입 확인
```bash
# TypeScript 프로젝트에서
npm install @struktos/core
# IDE에서 자동완성이 작동하는지 확인
```

## 🔧 일반적인 문제 해결

### 1. "You must be logged in to publish packages"
```bash
npm login
# Username, Password, Email 입력
```

### 2. "You do not have permission to publish"
- Organization 멤버인지 확인
- 또는 package name을 자신의 scope로 변경

### 3. "Package name too similar to existing package"
- 다른 이름으로 변경 필요
- 예: `@your-username/struktos-core`

### 4. "Cannot publish over existing version"
```bash
# 버전을 올려야 합니다
npm version patch
npm publish --access public
```

### 5. 발행 취소하기 (24시간 이내만 가능)
```bash
# 특정 버전 삭제
npm unpublish @struktos/core@0.1.0

# 전체 패키지 삭제 (주의!)
npm unpublish @struktos/core --force
```

## 📋 발행 체크리스트

발행 전에 다음 항목들을 확인하세요:

- [ ] `npm run build` 성공
- [ ] `dist/` 디렉토리에 모든 파일 존재
- [ ] `package.json`에 올바른 정보 입력
  - [ ] name
  - [ ] version
  - [ ] description
  - [ ] author
  - [ ] license
  - [ ] repository
  - [ ] keywords
- [ ] `README.md` 작성 완료
- [ ] `LICENSE` 파일 존재
- [ ] `.npmignore` 또는 `files` 필드 설정
- [ ] `npm pack --dry-run`으로 확인
- [ ] NPM 로그인 완료

## 🎯 권장 워크플로우

```bash
# 1. 기능 개발 및 테스트
npm run build
npm run poc

# 2. 버전 업데이트
npm version patch  # 또는 minor, major

# 3. Dry run
npm publish --dry-run

# 4. 실제 발행
npm publish --access public

# 5. Git에 태그 푸시
git push && git push --tags
```

## 📊 버전 관리 전략

### Semantic Versioning (SemVer)
- **Patch** (0.1.x): 버그 수정
- **Minor** (0.x.0): 새 기능 추가 (하위 호환)
- **Major** (x.0.0): 호환성 깨지는 변경

### 예시
```
0.1.0 → 초기 릴리스
0.1.1 → 버그 수정
0.2.0 → Context API 개선 (하위 호환)
1.0.0 → 정식 릴리스 (프로덕션 준비 완료)
```

## 🔗 유용한 명령어

```bash
# 현재 발행된 버전 확인
npm view @struktos/core version

# 모든 버전 확인
npm view @struktos/core versions

# 패키지 정보 확인
npm view @struktos/core

# 다운로드 통계
npm view @struktos/core downloads

# 로컬 테스트 (발행 전)
npm link
cd ../other-project
npm link @struktos/core
```

## 📝 추가 팁

1. **Beta 버전 발행**
   ```bash
   npm version 0.2.0-beta.1
   npm publish --tag beta
   ```

2. **자동화 (GitHub Actions)**
   - `.github/workflows/publish.yml` 설정
   - 태그 푸시 시 자동 발행

3. **발행 후 할 일**
   - GitHub Release 작성
   - CHANGELOG.md 업데이트
   - Twitter/블로그 공지

---

준비가 되면 `npm publish --access public` 명령어로 발행하세요! 🚀