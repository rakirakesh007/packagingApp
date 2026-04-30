# Code Conventions: Zero-Rejection Checklist (2026 Gold Standards)

## E1: Use Angular Standalone Components
- Ensure all components are standalone.
- Avoid NgModules unless absolutely necessary.

## E2: Change Detection Strategy
- Use `ChangeDetectionStrategy.OnPush` for all components.

## E3: Signals for State Management
- Prefer Angular Signals for reactive state management.
- Avoid legacy RxJS subjects unless required.

## E4: Dependency Injection
- Use the `inject()` function for dependency injection.
- Avoid constructor-based injection unless legacy code demands it.

## E5: Strict TypeScript
- Enable `strict` mode in `tsconfig.json`.
- Avoid `any` type; use `unknown` or proper types.

## E6: Linting and Formatting
- Use ESLint with Angular-specific rules.
- Prettier for consistent formatting.

## E7: Folder Structure
- Follow feature-based folder structure.
- Example:
  ```
  /features
    /auth
      auth.component.ts
      auth.service.ts
    /dashboard
      dashboard.component.ts
  ```

## E8: Component Naming
- Use `kebab-case` for file names.
- Example: `user-profile.component.ts`.

## E9: Testing
- Write unit tests for all components and services.
- Use Jasmine and Karma for Angular tests.

## E10: Accessibility
- Ensure all components are WCAG 2.1 compliant.
- Use semantic HTML and ARIA roles.

## E11: Performance Optimization
- Lazy load modules and components.
- Use Angular's built-in optimization tools.

## E12: API Integration
- Use Angular's HttpClient for API calls.
- Handle errors gracefully with interceptors.

## E13: Cold Start Handling
- Implement global loading signals for cold starts.
- Use Render's best practices for serverless APIs.

## E14: Documentation
- Document all public methods and classes with JSDoc.
- Maintain a `README.md` for each feature folder.

## E15: Version Control
- Use Git with clear commit messages.
- Follow Conventional Commits specification.

---

Adhering to these conventions ensures maintainability, scalability, and performance of the application.