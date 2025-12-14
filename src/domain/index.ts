/**
 * @fileoverview Domain Layer Exports
 * @description
 * The Domain Layer contains the core business logic abstractions
 * following Domain-Driven Design (DDD) principles.
 *
 * This layer includes:
 * - **Repository Pattern**: Data access abstractions with Unit of Work support
 * - **Specification Pattern**: Business rules and query composition
 * - **Entity/Value Object**: Base domain model abstractions (from existing core)
 *
 * @packageDocumentation
 * @module @struktos/core/domain
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * import {
 *   IUnitOfWork,
 *   ISpecification,
 *   SpecificationBase
 * } from '@struktos/core/domain';
 *
 * // Create a specification for active users
 * class ActiveUserSpec extends SpecificationBase<User> {
 *   isSatisfiedBy(user: User): boolean {
 *     return user.isActive && !user.isDeleted;
 *   }
 * }
 *
 * // Use within a unit of work transaction
 * async function processActiveUsers(uow: IUnitOfWork<MyContext>) {
 *   await uow.start();
 *   try {
 *     const userRepo = uow.getRepository<User>('users');
 *     // ... business logic
 *     await uow.commit();
 *   } catch (error) {
 *     await uow.rollback();
 *     throw error;
 *   }
 * }
 * ```
 */

// Repository abstractions (including Unit of Work)
export * from './repository';

// Specification pattern
export * from './specification';

// Core context propagation and management
export * from './context';

// Exception abstractions for exception handling
export * from './exceptions'