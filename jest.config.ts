import type { Config } from 'jest'
// eslint-disable-next-line import/no-extraneous-dependencies
import { pathsToModuleNameMapper } from 'ts-jest'

import { compilerOptions } from './tsconfig.paths.json'

/** @type {import('ts-jest').JestConfigWithTsJest} */
const config: Config = {
  testTimeout: 45000,
  preset: 'ts-jest',
  modulePaths: ['<rootDir>'],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths),
  modulePathIgnorePatterns: ['__mocks__']
}

export default config
