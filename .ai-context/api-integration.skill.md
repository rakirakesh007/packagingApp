# API Integration Skill

## Purpose
This skill provides guidelines for building robust services that handle Render's cold start issues and ensure seamless API integration in the Spice Distribution App.

## Best Practices

### 1. Global Loading Signal
- Implement a global loading signal using Angular Signals.
- Example:
  ```typescript
  import { signal } from '@angular/core';

  export const globalLoading = signal(false);
  ```
- Use this signal to indicate loading state across the app.

### 2. Cold Start Handling
- Detect and handle cold starts by:
  - Logging API response times.
  - Displaying a user-friendly loading message during delays.

### 3. Service Design
- Use Angular's HttpClient for all API calls.
- Example:
  ```typescript
  import { HttpClient } from '@angular/common/http';
  import { inject } from '@angular/core';

  export class ApiService {
    private http = inject(HttpClient);

    getData() {
      return this.http.get('/api/data');
    }
  }
  ```

### 4. Error Handling
- Use interceptors to handle errors globally.
- Example:
  ```typescript
  import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
  import { Observable } from 'rxjs';
  import { catchError } from 'rxjs/operators';

  export class ErrorInterceptor implements HttpInterceptor {
    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
      return next.handle(req).pipe(
        catchError(error => {
          console.error('API Error:', error);
          throw error;
        })
      );
    }
  }
  ```

### 5. Retry Logic
- Implement retry logic for transient errors.
- Example:
  ```typescript
  import { retry } from 'rxjs/operators';

  this.http.get('/api/data').pipe(
    retry(3)
  ).subscribe();
  ```

### 6. Documentation
- Document all API endpoints and their usage.
- Maintain a Postman collection for testing.

---

Following these practices ensures reliable and efficient API integration, even under challenging conditions like serverless cold starts.