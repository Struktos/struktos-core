/**
 * @fileoverview Domain Repository Layer Exports
 * @description
 * This module exports all repository-related abstractions including
 * the Unit of Work pattern for transaction management.
 *
 * @packageDocumentation
 * @module @struktos/core/domain/repository
 * @version 1.0.0
 */

// Unit of Work Pattern
export {
  // Enums
  IsolationLevel,
  TransactionState,

  // DI Tokens
  UNIT_OF_WORK_TOKEN,
  UNIT_OF_WORK_FACTORY_TOKEN,
} from './IUnitOfWork';

export type {
  // Main interfaces
  IUnitOfWork,
  IUnitOfWorkFactory,

  // Types
  TransactionOptions,
  TransactionResult,
  RepositoryToken,
} from './IUnitOfWork';
