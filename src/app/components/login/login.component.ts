import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {

  loading = false;

  constructor(private authService: AuthService) {}

  /**
   * Avvia il processo di login con Keycloak
   */
  loginWithKeycloak(): void {
    this.loading = true;
    this.authService.login();
  }
}
