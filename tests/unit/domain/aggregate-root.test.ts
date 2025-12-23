/**
 * @fileoverview Unit tests for Aggregate Root and Domain Events
 * 
 * Tests the domain purity of aggregates and their event raising capabilities.
 * 
 * CRITICAL: Aggregate roots must have ZERO infrastructure dependencies.
 */

import { IDomainEvent, EventMetadata, AggregateRoot } from '../../../src';

// ============================================================================
// Test Domain: User Aggregate
// ============================================================================

/**
 * User Created event payload
 */
interface UserCreatedPayload {
  userId: string;
  email: string;
  name: string;
}

/**
 * User Email Changed event payload
 */
interface UserEmailChangedPayload {
  userId: string;
  oldEmail: string;
  newEmail: string;
}

/**
 * User Deleted event payload
 */
interface UserDeletedPayload {
  userId: string;
  deletedAt: string;
}

/**
 * User Created domain event
 */
class UserCreatedEvent implements IDomainEvent<UserCreatedPayload> {
  public readonly eventName = 'UserCreated';
  public readonly metadata: EventMetadata;

  constructor(public readonly payload: UserCreatedPayload) {
    this.metadata = {
      eventId: `evt-${Date.now()}-${Math.random()}`,
      occurredAt: new Date().toISOString(),
    };
  }
}

/**
 * User Email Changed domain event
 */
class UserEmailChangedEvent implements IDomainEvent<UserEmailChangedPayload> {
  public readonly eventName = 'UserEmailChanged';
  public readonly metadata: EventMetadata;

  constructor(public readonly payload: UserEmailChangedPayload) {
    this.metadata = {
      eventId: `evt-${Date.now()}-${Math.random()}`,
      occurredAt: new Date().toISOString(),
    };
  }
}

/**
 * User Deleted domain event
 */
class UserDeletedEvent implements IDomainEvent<UserDeletedPayload> {
  public readonly eventName = 'UserDeleted';
  public readonly metadata: EventMetadata;

  constructor(public readonly payload: UserDeletedPayload) {
    this.metadata = {
      eventId: `evt-${Date.now()}-${Math.random()}`,
      occurredAt: new Date().toISOString(),
    };
  }
}

/**
 * User aggregate root extending AggregateRoot base class
 */
class User extends AggregateRoot {
  constructor(
    public readonly id: string,
    public email: string,
    public readonly name: string,
    public isDeleted: boolean = false
  ) {
    super();
  }

  static create(email: string, name: string): User {
    const user = new User(`user-${Date.now()}`, email, name);

    user.raiseEvent(
      new UserCreatedEvent({
        userId: user.id,
        email: user.email,
        name: user.name,
      })
    );

    return user;
  }

  changeEmail(newEmail: string): void {
    const oldEmail = this.email;
    this.email = newEmail;

    this.raiseEvent(
      new UserEmailChangedEvent({
        userId: this.id,
        oldEmail,
        newEmail,
      })
    );
  }

  delete(): void {
    this.isDeleted = true;

    this.raiseEvent(
      new UserDeletedEvent({
        userId: this.id,
        deletedAt: new Date().toISOString(),
      })
    );
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('AggregateRoot and Domain Events', () => {
  // ==========================================================================
  // EVENT RAISING
  // ==========================================================================

  describe('Event Raising', () => {
    it('should raise UserCreatedEvent when user is created', () => {
      const user = User.create('john@example.com', 'John Doe');

      expect(user.domainEvents).toHaveLength(1);
      expect(user.domainEvents[0]!.eventName).toBe('UserCreated');
      expect((user.domainEvents[0] as UserCreatedEvent).payload.email).toBe('john@example.com');
      expect((user.domainEvents[0] as UserCreatedEvent).payload.name).toBe('John Doe');
    });

    it('should raise UserEmailChangedEvent when email changes', () => {
      const user = User.create('john@example.com', 'John Doe');
      user.clearEvents(); // Clear creation event

      user.changeEmail('newemail@example.com');

      expect(user.domainEvents).toHaveLength(1);
      expect(user.domainEvents[0]!.eventName).toBe('UserEmailChanged');
      expect((user.domainEvents[0] as UserEmailChangedEvent).payload.oldEmail).toBe('john@example.com');
      expect((user.domainEvents[0] as UserEmailChangedEvent).payload.newEmail).toBe('newemail@example.com');
    });

    it('should raise UserDeletedEvent when user is deleted', () => {
      const user = User.create('john@example.com', 'John Doe');
      user.clearEvents();

      user.delete();

      expect(user.domainEvents).toHaveLength(1);
      expect(user.domainEvents[0]!.eventName).toBe('UserDeleted');
      expect((user.domainEvents[0] as UserDeletedEvent).payload.userId).toBe(user.id);
    });

    it('should accumulate multiple events', () => {
      const user = User.create('john@example.com', 'John Doe');

      user.changeEmail('newemail@example.com');
      user.changeEmail('another@example.com');

      expect(user.domainEvents).toHaveLength(3);
      expect(user.domainEvents[0]!.eventName).toBe('UserCreated');
      expect(user.domainEvents[1]!.eventName).toBe('UserEmailChanged');
      expect(user.domainEvents[2]!.eventName).toBe('UserEmailChanged');
    });
  });

  // ==========================================================================
  // EVENT CLEARING
  // ==========================================================================

  describe('Event Clearing', () => {
    it('should clear all domain events', () => {
      const user = User.create('john@example.com', 'John Doe');
      expect(user.domainEvents).toHaveLength(1);

      user.clearEvents();

      expect(user.domainEvents).toHaveLength(0);
    });

    it('should prevent duplicate publishing', () => {
      const user = User.create('john@example.com', 'John Doe');

      // Extract events for publishing
      const events = [...user.domainEvents];

      // Clear to prevent duplicate publishing
      user.clearEvents();

      // Events still available in extracted array
      expect(events).toHaveLength(1);

      // But aggregate has no events
      expect(user.domainEvents).toHaveLength(0);
    });

    it('should allow new events after clearing', () => {
      const user = User.create('john@example.com', 'John Doe');
      user.clearEvents();

      user.changeEmail('newemail@example.com');

      expect(user.domainEvents).toHaveLength(1);
      expect(user.domainEvents[0]!.eventName).toBe('UserEmailChanged');
    });
  });

  // ==========================================================================
  // DOMAIN PURITY
  // ==========================================================================

  describe('Domain Purity', () => {
    it('should NOT depend on EventBus (infrastructure)', () => {
      const user = User.create('john@example.com', 'John Doe');

      // Domain layer MUST be pure
      expect((user as any).eventBus).toBeUndefined();
      expect((user as any).repository).toBeUndefined();
      expect((user as any).database).toBeUndefined();

      // Events stored internally, not published
      expect(user.domainEvents).toHaveLength(1);
      expect(user.domainEvents[0]!.eventName).toBe('UserCreated');
    });

    it('should NOT depend on Repository (infrastructure)', () => {
      const user = User.create('john@example.com', 'John Doe');

      // Aggregate should not have save() method
      expect((user as any).save).toBeUndefined();

      // Events are just stored, not persisted
      expect(user.domainEvents).toHaveLength(1);
    });

    it('should NOT depend on Database (infrastructure)', () => {
      const user = User.create('john@example.com', 'John Doe');

      // Aggregate should not have database connection
      expect((user as any).db).toBeUndefined();
      expect((user as any).connection).toBeUndefined();
      expect((user as any).transaction).toBeUndefined();
    });
  });

  // ==========================================================================
  // EVENT METADATA
  // ==========================================================================

  describe('Event Metadata', () => {
    it('should auto-generate eventId', () => {
      const user = User.create('john@example.com', 'John Doe');

      const event = user.domainEvents[0];
      expect(event!.metadata.eventId).toBeDefined();
      expect(event!.metadata.eventId).toContain('evt-');
    });

    it('should auto-generate occurredAt timestamp', () => {
      const before = new Date();
      const user = User.create('john@example.com', 'John Doe');
      const after = new Date();

      const event = user.domainEvents[0];
      const occurredAt = new Date(event!.metadata.occurredAt);

      expect(occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should support custom metadata (correlationId, actorId)', () => {
      class CustomUserCreatedEvent implements IDomainEvent<UserCreatedPayload> {
        public readonly eventName = 'UserCreated';
        public readonly metadata: EventMetadata;

        constructor(
          public readonly payload: UserCreatedPayload,
          correlationId: string,
          actorId: string
        ) {
          this.metadata = {
            eventId: `evt-${Date.now()}`,
            occurredAt: new Date().toISOString(),
            correlationId,
            actorId,
          };
        }
      }

      class CustomUser extends AggregateRoot {
        constructor(
          public readonly id: string,
          public readonly email: string
        ) {
          super();
        }

        static create(email: string, correlationId: string, actorId: string): CustomUser {
          const user = new CustomUser(`user-${Date.now()}`, email);

          user.raiseEvent(
            new CustomUserCreatedEvent(
              { userId: user.id, email: user.email, name: 'Test' },
              correlationId,
              actorId
            )
          );

          return user;
        }
      }

      const user = CustomUser.create(
        'john@example.com',
        'corr-123',
        'admin-456'
      );

      const event = user.domainEvents[0];
      expect(event!.metadata.correlationId).toBe('corr-123');
      expect(event!.metadata.actorId).toBe('admin-456');
    });
  });

  // ==========================================================================
  // EVENT IMMUTABILITY
  // ==========================================================================

  describe('Event Immutability', () => {
    it('should have readonly eventName', () => {
      const user = User.create('john@example.com', 'John Doe');
      const event = user.domainEvents[0] as UserCreatedEvent;

      // TypeScript enforces readonly at compile time
      expect(event.eventName).toBe('UserCreated');
    });

    it('should have readonly payload', () => {
      const user = User.create('john@example.com', 'John Doe');
      const event = user.domainEvents[0] as UserCreatedEvent;

      // TypeScript enforces readonly at compile time
      expect(event.payload.email).toBe('john@example.com');
    });

    it('should have readonly metadata', () => {
      const user = User.create('john@example.com', 'John Doe');
      const event = user.domainEvents[0];

      // TypeScript enforces readonly at compile time
      expect(event!.metadata.eventId).toBeDefined();
    });
  });

  // ==========================================================================
  // REPOSITORY PATTERN INTEGRATION
  // ==========================================================================

  describe('Repository Pattern Integration', () => {
    it('should simulate repository extracting events', () => {
      // Aggregate created
      const user = User.create('john@example.com', 'John Doe');

      // Repository saves aggregate
      const eventsToPublish = [...user.domainEvents];
      user.clearEvents();

      // Events extracted
      expect(eventsToPublish).toHaveLength(1);
      expect(eventsToPublish[0]!.eventName).toBe('UserCreated');

      // Aggregate has no events
      expect(user.domainEvents).toHaveLength(0);
    });

    it('should simulate repository rollback scenario', () => {
      const user = User.create('john@example.com', 'John Doe');

      // Database error occurs
      // Repository decides NOT to extract events

      // Events discarded (not cleared)
      expect(user.domainEvents).toHaveLength(1);

      // In real implementation, aggregate would be discarded
      // Events never published
    });
  });
});