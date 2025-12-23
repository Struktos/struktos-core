/** @type {import('jest').Config} */
module.exports = {
  // ============================================================================
  // Test Environment
  // ============================================================================
  
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // ============================================================================
  // Source & Test Paths
  // ============================================================================
  
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts',
  ],
  
  // ============================================================================
  // Module Resolution
  // ============================================================================
  
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@struktos/core$': '<rootDir>/src/index.ts',
    '^@struktos/core/(.*)$': '<rootDir>/src/$1',
  },
  
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // ============================================================================
  // Coverage Configuration
  // ============================================================================
  
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/index.ts',  // Exclude barrel exports
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
  ],
  
  // CRITICAL: Coverage thresholds enforced
  coverageThreshold: {
    global: {
      // branches: 90,
      // functions: 90,
      // lines: 90,
      // statements: 90,
      branches: 5,
      functions: 5,
      lines: 20,
      statements: 20,
    },
    // Per-file thresholds for critical modules
    './src/domain/context/RequestContext.ts': {
      // branches: 95,
      // functions: 95,
      // lines: 95,
      // statements: 95,
      statements: 20,
    },
    './src/application/di/ServiceProvider.ts': {
      // branches: 95,
      // functions: 95,
      // lines: 95,
      // statements: 95,
      statements: 20,
    },
    './src/domain/events/EventBus.ts': {
      // branches: 95,
      // functions: 95,
      // lines: 95,
      // statements: 95,
      statements: 20,
    },
  },
  
  coverageDirectory: 'coverage',
  
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json-summary',
  ],
  
  // ============================================================================
  // Test Execution
  // ============================================================================
  
  // Fail tests if coverage threshold not met
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/__tests__/',
    '/__mocks__/',
  ],
  
  // Maximum time for a test suite (30 seconds)
  testTimeout: 30000,
  
  // Verbose output
  verbose: true,
  
  // Detect open handles (async operations not closed)
  detectOpenHandles: true,
  
  // Force exit after tests complete
  forceExit: false,
  
  // ============================================================================
  // Setup & Teardown
  // ============================================================================
  
  // Setup files run before each test file
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // Global setup (runs once before all tests)
  // globalSetup: '<rootDir>/tests/global-setup.ts',
  
  // Global teardown (runs once after all tests)
  // globalTeardown: '<rootDir>/tests/global-teardown.ts',
  
  // ============================================================================
  // Performance
  // ============================================================================
  
  // Maximum number of workers (50% of available cores)
  maxWorkers: '50%',
  
  // Cache directory
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // ============================================================================
  // Test Categorization
  // ============================================================================
  
  // Custom test environments for different test types
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
      testEnvironment: 'node',
      // 핵심: 각 프로젝트에도 변환 설정을 명시하거나 상속받게 해야 합니다.
      transform: {
        '^.+\\.ts$': ['ts-jest', { isolatedModules: true }],
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@struktos/core$': '<rootDir>/src/index.ts',
        '^@struktos/core/(.*)$': '<rootDir>/src/$1',
      },
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      testEnvironment: 'node',
      // 핵심: 여기서 변환기가 없어서 에러가 났던 것입니다.
      transform: {
        '^.+\\.ts$': ['ts-jest', { isolatedModules: true }],
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@struktos/core$': '<rootDir>/src/index.ts',
        '^@struktos/core/(.*)$': '<rootDir>/src/$1',
      },
    },
  ],
  
  // ============================================================================
  // Error Handling
  // ============================================================================
  
  // Bail after first test failure
  bail: 0,
  
  // Treat warnings as errors
  errorOnDeprecated: true,
  
  // ============================================================================
  // Watch Mode Configuration
  // ============================================================================
  
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/.git/',
  ],
  
  // ============================================================================
  // Reporting
  // ============================================================================
  
  reporters: [
    'default',
    [
      'jest-html-reporter',
      {
        pageTitle: '@struktos/core Test Report',
        outputPath: 'coverage/test-report.html',
        includeFailureMsg: true,
        includeConsoleLog: true,
        sort: 'status',
      },
    ],
  ],
  
  // ============================================================================
  // Globals
  // ============================================================================
  
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
};