import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `
    <div class="d-flex justify-content-center align-items-center vh-100">
      <div class="text-center">
        <div class="spinner-border text-primary mb-3" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <h4>Completamento login...</h4>
        <p class="text-muted">Ti stiamo reindirizzando</p>
      </div>
    </div>
  `
})
export class AuthCallbackComponent implements OnInit {

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const code = this.route.snapshot.queryParams['code'];

    if (code) {
      this.handleAuthCallback(code);
    } else {
      console.error('No authorization code found');
      this.router.navigate(['/login']);
    }
  }

  private handleAuthCallback(code: string): void {
    this.authService.handleAuthCallback(code).subscribe({
      next: (response) => {
        // Salva il token
        this.authService.setTokens(response.access_token, response.id_token);
        console.log('Login successful');
        // Redirect alla home
        this.router.navigate(['/']);
      },
      error: (error) => {
        console.error('Login failed:', error);
        this.router.navigate(['/login']);
        this.authService.logout();
      }
    });
  }
}
