# Coding Guidelines

## General Principles

* Always prioritize readability and maintainability over clever solutions.
* Follow existing project conventions and patterns before introducing new ones.
* Do not introduce breaking changes unless explicitly requested.
* Keep functions and classes focused on a single responsibility.
* Avoid code duplication. Reuse existing utilities and abstractions whenever possible.
* Prefer simple solutions over over-engineered implementations.
* Write production-ready code; avoid placeholder implementations and TODOs unless requested.

## Before Writing Code

* Understand the existing implementation and dependencies before making changes.
* Search for similar patterns already used in the codebase and follow them.
* Clarify ambiguous requirements instead of making assumptions.
* Consider edge cases, validation requirements, and failure scenarios.

## Code Quality

* Use meaningful and descriptive names for variables, functions, classes, and files.
* Keep functions small and focused.
* Avoid deeply nested conditions; favor guard clauses and early returns.
* Remove unused imports, variables, and dead code.
* Ensure the code passes linting and formatting standards.
* Maintain consistent naming conventions throughout the codebase.

## Architecture

* Follow separation of concerns.
* Keep business logic out of controllers, routes, and UI components.
* Use service layers for application logic.
* Use repositories or data-access layers for database interactions.
* Avoid tight coupling between modules.
* Prefer dependency injection where applicable.

## Error Handling

* Never swallow exceptions silently.
* Handle expected failures gracefully.
* Return meaningful error messages without exposing internal implementation details.
* Log errors with sufficient context for troubleshooting.

## Security

* Never hardcode secrets, API keys, tokens, or credentials.
* Use environment variables for configuration.
* Validate and sanitize all external inputs.
* Apply authentication and authorization checks consistently.
* Follow the principle of least privilege.

## Database Practices

* Use migrations for all schema changes.
* Avoid raw queries unless necessary and justified.
* Use transactions for operations involving multiple dependent writes.
* Prevent N+1 query problems.
* Add indexes for frequently queried fields.
* Design queries with performance in mind.

## API Development

* Validate request payloads and query parameters.
* Return consistent response structures.
* Use proper HTTP status codes.
* Maintain backward compatibility when possible.
* Document API changes and breaking changes.

## Testing

* **Backend tests are required** for every new endpoint and module. Add test cases at the same time as the implementation — not after.
* Cover happy paths, edge cases, and error scenarios.
* Ensure existing tests continue to pass before committing.
* Avoid reducing test coverage without justification.
* Test file location: `backend/src/<module>/<module>.spec.ts` (unit tests) alongside the module it tests.
* Integration tests live in `backend/src/<module>/<module>.e2e-spec.ts`.

## React Native Specific

* Keep UI components presentational whenever possible.
* Extract reusable components instead of duplicating UI.
* Avoid unnecessary re-renders.
* Handle loading, empty, and error states.
* Keep business logic outside screen components.
* Use centralized state management consistently.

## NestJS Specific

* Keep controllers thin and delegate logic to services.
* Use DTOs for request validation.
* Use guards, interceptors, and filters appropriately.
* Organize features using NestJS modules.
* Follow dependency injection patterns.

## FastAPI Specific

* Use Pydantic models for validation and serialization.
* Keep route handlers lightweight.
* Move business logic into services.
* Use dependency injection through FastAPI dependencies.
* Handle exceptions using standardized exception handlers.

## PostgreSQL Specific

* Use appropriate data types and constraints.
* Define foreign keys where relationships exist.
* Avoid SELECT * in production queries.
* Use pagination for large result sets.
* Monitor and optimize slow queries.

## Database Operations & Security

* Never create, modify, or delete database users without explicit approval.
* Never grant SUPERUSER privileges unless explicitly requested.
* Do not assume passwords; ask before setting credentials.
* Prefer read-only diagnostics first.
* Explain the proposed actions and their impact before executing destructive or privileged operations.
* Use the principle of least privilege when creating database roles.
* Show the exact commands before executing them if they affect security or infrastructure.
* Distinguish between discovery, verification, and modification steps.

## Pull Request Expectations

* Summarize what changed and why.
* Mention any assumptions made.
* Highlight potential risks or breaking changes.
* Include testing details and validation steps — tests are required for every new endpoint or module.
* Keep changes focused on the requested scope.
* Do not modify unrelated files without justification.

## Output Expectations

* Explain the approach before major changes.
* Show only the necessary code modifications.
* Preserve existing functionality unless instructed otherwise.
* If a better alternative exists, propose it and explain the trade-offs.
* When uncertain, ask for clarification instead of guessing.