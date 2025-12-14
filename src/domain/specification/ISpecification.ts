/**
 * @struktos/core - Specification Pattern Interface
 *
 * Provides Specification pattern abstractions for encapsulating business rules
 * and building composable, reusable query conditions. Enables dynamic query
 * construction and validation logic in a type-safe manner.
 *
 * @module domain/specification/ISpecification
 * @see {@link https://martinfowler.com/apsupp/spec.pdf | Specification Pattern}
 */

/**
 * ISpecification - Core specification interface for domain rules.
 *
 * A Specification is a predicate that determines if an object satisfies
 * certain criteria. Specifications can be combined using AND, OR, and NOT
 * operations to build complex business rules.
 *
 * @template T - The type of entity this specification applies to
 *
 * @remarks
 * The Specification pattern is useful for:
 * - **Domain validation**: Encapsulating business rules as reusable objects
 * - **Query building**: Translating specifications to database queries
 * - **Selection criteria**: Filtering collections based on business rules
 * - **Policy enforcement**: Checking if entities satisfy certain policies
 *
 * @example
 * ```typescript
 * // Simple specification
 * class ActiveUserSpecification implements ISpecification<User> {
 *   isSatisfiedBy(user: User): boolean {
 *     return user.status === 'active' && !user.deletedAt;
 *   }
 * }
 *
 * // Usage
 * const spec = new ActiveUserSpecification();
 * const activeUsers = users.filter(u => spec.isSatisfiedBy(u));
 * ```
 *
 * @example
 * ```typescript
 * // Composite specification
 * const premiumActiveUser = new ActiveUserSpecification()
 *   .and(new PremiumUserSpecification())
 *   .and(new EmailVerifiedSpecification());
 *
 * const eligibleUsers = users.filter(u => premiumActiveUser.isSatisfiedBy(u));
 * ```
 *
 * @example
 * ```typescript
 * // Specification with parameters
 * class MinimumAgeSpecification implements ISpecification<User> {
 *   constructor(private readonly minimumAge: number) {}
 *
 *   isSatisfiedBy(user: User): boolean {
 *     const age = this.calculateAge(user.birthDate);
 *     return age >= this.minimumAge;
 *   }
 *
 *   private calculateAge(birthDate: Date): number {
 *     // ... age calculation logic
 *   }
 * }
 *
 * const adultSpec = new MinimumAgeSpecification(18);
 * const seniorSpec = new MinimumAgeSpecification(65);
 * ```
 */
export interface ISpecification<T> {
  /**
   * Check if the candidate satisfies this specification.
   *
   * @param candidate - The entity to check against the specification
   * @returns True if the candidate satisfies the specification, false otherwise
   *
   * @example
   * ```typescript
   * class InStockSpecification implements ISpecification<Product> {
   *   isSatisfiedBy(product: Product): boolean {
   *     return product.quantity > 0;
   *   }
   * }
   *
   * const inStock = new InStockSpecification();
   * console.log(inStock.isSatisfiedBy(product)); // true or false
   * ```
   */
  isSatisfiedBy(candidate: T): boolean;

  /**
   * Combine this specification with another using logical AND.
   *
   * The resulting specification is satisfied only if both
   * this specification AND the other specification are satisfied.
   *
   * @param other - The specification to combine with
   * @returns A new specification representing the AND combination
   *
   * @example
   * ```typescript
   * const activeAndPremium = activeSpec.and(premiumSpec);
   *
   * // Equivalent to:
   * // activeSpec.isSatisfiedBy(user) && premiumSpec.isSatisfiedBy(user)
   * ```
   */
  and(other: ISpecification<T>): ISpecification<T>;

  /**
   * Combine this specification with another using logical OR.
   *
   * The resulting specification is satisfied if either
   * this specification OR the other specification is satisfied.
   *
   * @param other - The specification to combine with
   * @returns A new specification representing the OR combination
   *
   * @example
   * ```typescript
   * const adminOrModerator = adminSpec.or(moderatorSpec);
   *
   * // Equivalent to:
   * // adminSpec.isSatisfiedBy(user) || moderatorSpec.isSatisfiedBy(user)
   * ```
   */
  or(other: ISpecification<T>): ISpecification<T>;

  /**
   * Negate this specification using logical NOT.
   *
   * The resulting specification is satisfied only if
   * this specification is NOT satisfied.
   *
   * @returns A new specification representing the negation
   *
   * @example
   * ```typescript
   * const notBanned = bannedSpec.not();
   *
   * // Equivalent to:
   * // !bannedSpec.isSatisfiedBy(user)
   * ```
   */
  not(): ISpecification<T>;
}

/**
 * Abstract base class for specifications with default combinator implementations.
 *
 * Provides default implementations for AND, OR, and NOT operations,
 * so subclasses only need to implement `isSatisfiedBy`.
 *
 * @template T - The type of entity this specification applies to
 *
 * @example
 * ```typescript
 * class PriceRangeSpecification extends SpecificationBase<Product> {
 *   constructor(
 *     private readonly minPrice: number,
 *     private readonly maxPrice: number,
 *   ) {
 *     super();
 *   }
 *
 *   isSatisfiedBy(product: Product): boolean {
 *     return product.price >= this.minPrice && product.price <= this.maxPrice;
 *   }
 * }
 *
 * // All combinator methods are automatically available
 * const affordableAndInStock = new PriceRangeSpecification(0, 100)
 *   .and(new InStockSpecification());
 * ```
 */
export abstract class SpecificationBase<T> implements ISpecification<T> {
  /**
   * Check if the candidate satisfies this specification.
   * Must be implemented by subclasses.
   *
   * @param candidate - The entity to check
   * @returns True if satisfied, false otherwise
   */
  abstract isSatisfiedBy(candidate: T): boolean;

  /**
   * Combine with another specification using AND.
   *
   * @param other - The other specification
   * @returns Combined AND specification
   */
  and(other: ISpecification<T>): ISpecification<T> {
    return new AndSpecification<T>(this, other);
  }

  /**
   * Combine with another specification using OR.
   *
   * @param other - The other specification
   * @returns Combined OR specification
   */
  or(other: ISpecification<T>): ISpecification<T> {
    return new OrSpecification<T>(this, other);
  }

  /**
   * Negate this specification.
   *
   * @returns Negated specification
   */
  not(): ISpecification<T> {
    return new NotSpecification<T>(this);
  }
}

/**
 * AND composite specification.
 *
 * Represents the logical AND of two specifications.
 * Both specifications must be satisfied for this to be satisfied.
 *
 * @template T - The type of entity
 *
 * @example
 * ```typescript
 * const andSpec = new AndSpecification(specA, specB);
 * console.log(andSpec.isSatisfiedBy(entity)); // specA && specB
 * ```
 */
export class AndSpecification<T> extends SpecificationBase<T> {
  /**
   * Left-hand specification.
   */
  readonly left: ISpecification<T>;

  /**
   * Right-hand specification.
   */
  readonly right: ISpecification<T>;

  /**
   * Create an AND specification from two specifications.
   *
   * @param left - Left-hand specification
   * @param right - Right-hand specification
   */
  constructor(left: ISpecification<T>, right: ISpecification<T>) {
    super();
    this.left = left;
    this.right = right;
  }

  /**
   * Check if both specifications are satisfied.
   *
   * @param candidate - The entity to check
   * @returns True if both specifications are satisfied
   */
  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate);
  }
}

/**
 * OR composite specification.
 *
 * Represents the logical OR of two specifications.
 * At least one specification must be satisfied for this to be satisfied.
 *
 * @template T - The type of entity
 *
 * @example
 * ```typescript
 * const orSpec = new OrSpecification(specA, specB);
 * console.log(orSpec.isSatisfiedBy(entity)); // specA || specB
 * ```
 */
export class OrSpecification<T> extends SpecificationBase<T> {
  /**
   * Left-hand specification.
   */
  readonly left: ISpecification<T>;

  /**
   * Right-hand specification.
   */
  readonly right: ISpecification<T>;

  /**
   * Create an OR specification from two specifications.
   *
   * @param left - Left-hand specification
   * @param right - Right-hand specification
   */
  constructor(left: ISpecification<T>, right: ISpecification<T>) {
    super();
    this.left = left;
    this.right = right;
  }

  /**
   * Check if either specification is satisfied.
   *
   * @param candidate - The entity to check
   * @returns True if either specification is satisfied
   */
  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) || this.right.isSatisfiedBy(candidate);
  }
}

/**
 * NOT specification decorator.
 *
 * Represents the logical NOT of a specification.
 * The wrapped specification must NOT be satisfied for this to be satisfied.
 *
 * @template T - The type of entity
 *
 * @example
 * ```typescript
 * const notSpec = new NotSpecification(bannedSpec);
 * console.log(notSpec.isSatisfiedBy(entity)); // !banned
 * ```
 */
export class NotSpecification<T> extends SpecificationBase<T> {
  /**
   * The specification to negate.
   */
  readonly wrapped: ISpecification<T>;

  /**
   * Create a NOT specification from another specification.
   *
   * @param wrapped - The specification to negate
   */
  constructor(wrapped: ISpecification<T>) {
    super();
    this.wrapped = wrapped;
  }

  /**
   * Check if the wrapped specification is NOT satisfied.
   *
   * @param candidate - The entity to check
   * @returns True if the wrapped specification is not satisfied
   */
  isSatisfiedBy(candidate: T): boolean {
    return !this.wrapped.isSatisfiedBy(candidate);
  }
}

/**
 * IQueryableSpecification - Specification that can be converted to a query expression.
 *
 * Extends the base specification with the ability to generate database
 * query expressions. This enables specifications to be used both for
 * in-memory filtering and database queries.
 *
 * @template T - The type of entity this specification applies to
 * @template TExpression - The query expression type (e.g., Prisma where clause, TypeORM FindOptions)
 *
 * @remarks
 * This interface bridges the gap between domain logic and persistence,
 * allowing the same specification to work with both in-memory collections
 * and database queries.
 *
 * @example
 * ```typescript
 * // For Prisma
 * interface PrismaWhereClause {
 *   AND?: PrismaWhereClause[];
 *   OR?: PrismaWhereClause[];
 *   NOT?: PrismaWhereClause;
 *   [key: string]: any;
 * }
 *
 * class ActiveUserSpecification
 *   extends SpecificationBase<User>
 *   implements IQueryableSpecification<User, PrismaWhereClause>
 * {
 *   isSatisfiedBy(user: User): boolean {
 *     return user.status === 'active' && !user.deletedAt;
 *   }
 *
 *   toExpression(): PrismaWhereClause {
 *     return {
 *       status: 'active',
 *       deletedAt: null,
 *     };
 *   }
 * }
 *
 * // Usage with repository
 * const spec = new ActiveUserSpecification();
 * const users = await userRepository.findBySpecification(spec);
 * // Generates: WHERE status = 'active' AND deletedAt IS NULL
 * ```
 *
 * @example
 * ```typescript
 * // For TypeORM
 * import { FindOptionsWhere } from 'typeorm';
 *
 * class PriceRangeSpecification
 *   extends SpecificationBase<Product>
 *   implements IQueryableSpecification<Product, FindOptionsWhere<Product>>
 * {
 *   constructor(
 *     private readonly min: number,
 *     private readonly max: number,
 *   ) {
 *     super();
 *   }
 *
 *   isSatisfiedBy(product: Product): boolean {
 *     return product.price >= this.min && product.price <= this.max;
 *   }
 *
 *   toExpression(): FindOptionsWhere<Product> {
 *     return {
 *       price: Between(this.min, this.max),
 *     };
 *   }
 * }
 * ```
 */
export interface IQueryableSpecification<T, TExpression = unknown> extends ISpecification<T> {
  /**
   * Convert this specification to a query expression.
   *
   * The expression type depends on the ORM/database being used
   * (e.g., Prisma where clause, TypeORM FindOptions, MongoDB filter).
   *
   * @returns Query expression that can be passed to the database
   *
   * @example
   * ```typescript
   * // Prisma example
   * toExpression(): Prisma.UserWhereInput {
   *   return {
   *     status: 'active',
   *     email: { contains: '@company.com' },
   *   };
   * }
   *
   * // MongoDB example
   * toExpression(): Filter<User> {
   *   return {
   *     status: 'active',
   *     email: { $regex: /@company\.com$/ },
   *   };
   * }
   * ```
   */
  toExpression(): TExpression;
}

/**
 * Specification visitor interface for expression building.
 *
 * Implements the Visitor pattern to traverse specification trees
 * and build query expressions. Useful for adapters that need to
 * convert specifications to database-specific queries.
 *
 * @template T - The entity type
 * @template TResult - The result type produced by the visitor
 *
 * @example
 * ```typescript
 * class PrismaSpecificationVisitor<T> implements ISpecificationVisitor<T, Prisma.WhereInput> {
 *   visitAnd(left: Prisma.WhereInput, right: Prisma.WhereInput): Prisma.WhereInput {
 *     return { AND: [left, right] };
 *   }
 *
 *   visitOr(left: Prisma.WhereInput, right: Prisma.WhereInput): Prisma.WhereInput {
 *     return { OR: [left, right] };
 *   }
 *
 *   visitNot(expression: Prisma.WhereInput): Prisma.WhereInput {
 *     return { NOT: expression };
 *   }
 *
 *   visitLeaf(spec: IQueryableSpecification<T, Prisma.WhereInput>): Prisma.WhereInput {
 *     return spec.toExpression();
 *   }
 * }
 * ```
 */
export interface ISpecificationVisitor<T, TResult> {
  /**
   * Visit an AND specification node.
   *
   * @param left - Result from visiting the left specification
   * @param right - Result from visiting the right specification
   * @returns Combined AND result
   */
  visitAnd(left: TResult, right: TResult): TResult;

  /**
   * Visit an OR specification node.
   *
   * @param left - Result from visiting the left specification
   * @param right - Result from visiting the right specification
   * @returns Combined OR result
   */
  visitOr(left: TResult, right: TResult): TResult;

  /**
   * Visit a NOT specification node.
   *
   * @param expression - Result from visiting the wrapped specification
   * @returns Negated result
   */
  visitNot(expression: TResult): TResult;

  /**
   * Visit a leaf (non-composite) specification.
   *
   * @param spec - The leaf specification
   * @returns Result for this specification
   */
  visitLeaf(spec: ISpecification<T>): TResult;
}

/**
 * Factory functions for creating common specifications.
 *
 * Provides a fluent API for building specifications without
 * creating explicit classes for simple cases.
 *
 * @example
 * ```typescript
 * // Using factory functions
 * const activeUsers = Specifications.where<User>(u => u.status === 'active');
 * const premiumUsers = Specifications.where<User>(u => u.tier === 'premium');
 *
 * const eligibleUsers = activeUsers.and(premiumUsers);
 * ```
 */
export const Specifications = {
  /**
   * Create a specification from a predicate function.
   *
   * @template T - The entity type
   * @param predicate - Function that checks if entity satisfies condition
   * @returns New specification based on the predicate
   *
   * @example
   * ```typescript
   * const adultSpec = Specifications.where<Person>(p => p.age >= 18);
   * const inStockSpec = Specifications.where<Product>(p => p.quantity > 0);
   * ```
   */
  where<T>(predicate: (candidate: T) => boolean): ISpecification<T> {
    return new PredicateSpecification(predicate);
  },

  /**
   * Create a specification that always returns true.
   *
   * @template T - The entity type
   * @returns Specification that matches all entities
   *
   * @example
   * ```typescript
   * // Useful as a default or starting point
   * let spec = Specifications.all<User>();
   * if (filterActive) {
   *   spec = spec.and(activeSpec);
   * }
   * ```
   */
  all<T>(): ISpecification<T> {
    return new PredicateSpecification(() => true);
  },

  /**
   * Create a specification that always returns false.
   *
   * @template T - The entity type
   * @returns Specification that matches no entities
   *
   * @example
   * ```typescript
   * // Useful for conditional logic
   * const spec = hasAccess ? activeSpec : Specifications.none<User>();
   * ```
   */
  none<T>(): ISpecification<T> {
    return new PredicateSpecification(() => false);
  },

  /**
   * Combine multiple specifications with AND.
   *
   * @template T - The entity type
   * @param specs - Array of specifications to combine
   * @returns Combined AND specification
   *
   * @example
   * ```typescript
   * const combined = Specifications.and<User>(
   *   activeSpec,
   *   premiumSpec,
   *   verifiedSpec
   * );
   * ```
   */
  and<T>(...specs: ISpecification<T>[]): ISpecification<T> {
    if (specs.length === 0) {
      return new PredicateSpecification(() => true);
    }
    return specs.reduce((acc, spec) => acc.and(spec));
  },

  /**
   * Combine multiple specifications with OR.
   *
   * @template T - The entity type
   * @param specs - Array of specifications to combine
   * @returns Combined OR specification
   *
   * @example
   * ```typescript
   * const hasPrivilegedRole = Specifications.or<User>(
   *   adminSpec,
   *   moderatorSpec,
   *   superUserSpec
   * );
   * ```
   */
  or<T>(...specs: ISpecification<T>[]): ISpecification<T> {
    if (specs.length === 0) {
      return new PredicateSpecification(() => false);
    }
    return specs.reduce((acc, spec) => acc.or(spec));
  },
};

/**
 * Predicate-based specification for functional creation.
 *
 * @template T - The entity type
 *
 * @internal
 */
class PredicateSpecification<T> extends SpecificationBase<T> {
  constructor(private readonly predicate: (candidate: T) => boolean) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.predicate(candidate);
  }
}

/**
 * Specification evaluation options.
 *
 * Configuration for how specifications should be evaluated,
 * including short-circuit behavior and error handling.
 *
 * @example
 * ```typescript
 * const options: SpecificationEvaluationOptions = {
 *   shortCircuit: true,
 *   throwOnError: false,
 *   defaultOnError: false,
 * };
 * ```
 */
export interface SpecificationEvaluationOptions {
  /**
   * Whether to use short-circuit evaluation for AND/OR.
   * When true, stops evaluating as soon as result is determined.
   * @defaultValue true
   */
  shortCircuit?: boolean;

  /**
   * Whether to throw errors that occur during evaluation.
   * When false, returns defaultOnError value.
   * @defaultValue false
   */
  throwOnError?: boolean;

  /**
   * Default value to return when an error occurs.
   * Only used when throwOnError is false.
   * @defaultValue false
   */
  defaultOnError?: boolean;
}

/**
 * Specification evaluation result with details.
 *
 * Provides detailed information about why a specification
 * was or was not satisfied.
 *
 * @template T - The entity type
 *
 * @example
 * ```typescript
 * const result = evaluateWithDetails(complexSpec, entity);
 *
 * if (!result.satisfied) {
 *   console.log('Failed specifications:');
 *   result.failedSpecifications.forEach(spec => {
 *     console.log(`- ${spec.constructor.name}: ${spec.reason}`);
 *   });
 * }
 * ```
 */
export interface SpecificationEvaluationResult<T> {
  /**
   * Whether the entity satisfied the specification.
   */
  satisfied: boolean;

  /**
   * The entity that was evaluated.
   */
  candidate: T;

  /**
   * Specifications that were satisfied.
   */
  satisfiedSpecifications: ISpecification<T>[];

  /**
   * Specifications that were not satisfied.
   */
  failedSpecifications: Array<{
    specification: ISpecification<T>;
    reason?: string;
  }>;

  /**
   * Evaluation duration in milliseconds.
   */
  duration: number;
}