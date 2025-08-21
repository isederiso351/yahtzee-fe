import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  console.log('FUNCTIONAL INTERCEPTOR CHIAMATO per:', req.url);

  const authService = inject(AuthService);
  const router = inject(Router);

  // Aggiungi token se autenticato
  const token = authService.getCurrentToken();

  if (authService.isAuthenticated()) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('Added JWT token to request:', req.url);
  }

  return next(req).pipe(
    catchError((error) => {
      if (error.status === 401) {
        console.log('Unauthorized - redirecting to login');
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
