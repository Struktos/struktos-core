/**
 * @fileoverview Domain Specification Pattern Exports
 * @description
 * This module exports all specification-related abstractions for
 * encapsulating business rules and composable query predicates.
 *
 * The Specification pattern allows you to:
 * - Encapsulate business rules as reusable, testable objects
 * - Compose complex rules using AND, OR, NOT operators
 * - Generate database queries from specifications
 *
 * @packageDocumentation
 * @module @struktos/core/domain/specification
 * @version 1.0.0
 *
 * @see {@link https://martinfowler.com/apsupp/spec.pdf | Martin Fowler - Specification Pattern}
 */

// Core Specification Interfaces
export {
  // Main interface
  ISpecification,

  // Base classes for implementation
  SpecificationBase,
  AndSpecification,
  OrSpecification,
  NotSpecification,

  // Queryable specification for database integration
  IQueryableSpecification,

  // Visitor pattern for traversal
  ISpecificationVisitor,

  // Factory utilities
  Specifications,

  // Evaluation types
  SpecificationEvaluationOptions,
  SpecificationEvaluationResult,
} from './ISpecification';