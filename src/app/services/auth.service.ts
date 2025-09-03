import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private tokenSubject = new BehaviorSubject<string | null>(null);

  public token$ = this.tokenSubject.asObservable();

  constructor(private http: HttpClient) {
    // Carica il token salvato al bootstrap
    const savedToken = localStorage.getItem('access_token');
    if (savedToken && !this.isTokenExpired(savedToken)) {
      this.tokenSubject.next(savedToken);
    }
  }

  /**
   * Verifica se l'utente è autenticato
   */
  isAuthenticated(): boolean {
    const token = this.tokenSubject.value;
    return !!token && !this.isTokenExpired(token);
  }

  /**
   * Ottiene il token corrente
   */
  getCurrentToken(): string | null {
    return this.tokenSubject.value;
  }

  /**
   * Inizia il processo di login con Keycloak
   */
  login(): void {
    const keycloakUrl = 'http://localhost:8081/realms/yahtzee-realm/protocol/openid-connect/auth';
    const clientId = 'yahtzee-fe-client';
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
    const responseType = 'code';
    const scope = 'openid profile email';

    const authUrl = `${keycloakUrl}?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=${responseType}&scope=${scope}`;

    console.log('Redirecting to Keycloak:', authUrl);
    window.location.href = authUrl;
  }

  /**
   * Gestisce il callback di autenticazione dopo il redirect da Keycloak
   */
  handleAuthCallback(code: string): Observable<any> {
    const tokenUrl = 'http://localhost:8081/realms/yahtzee-realm/protocol/openid-connect/token';

    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('client_id', 'yahtzee-fe-client');
    body.set('code', code);
    body.set('redirect_uri', window.location.origin + '/auth/callback');

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    return this.http.post<any>(tokenUrl, body.toString(), { headers });
  }

  /**
   * Imposta il token di autenticazione
   */
  setTokens(access_token: string, id_token: string): void {
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('id_token', id_token);
    this.tokenSubject.next(access_token);
  }

  /**
   * Effettua il logout
   */
  logout(): void {


    const keycloakLogoutUrl = 'http://localhost:8081/realms/yahtzee-realm/protocol/openid-connect/logout';
    const redirectUri = encodeURIComponent(window.location.origin);
    const idToken = localStorage.getItem('id_token');

    this.clearLocalAuth()

    let logoutUrl = `${keycloakLogoutUrl}?post_logout_redirect_uri=${redirectUri}`;

    if (idToken) {
      logoutUrl += `&id_token_hint=${idToken}`;
    }

    window.location.href = logoutUrl;
  }

  /**
   * Decodifica il payload di un JWT token
   */
  private decodeJWTPayload(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT token format');
      }

      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error('Failed to decode JWT payload');
    }
  }

  /**
   * Verifica se il token è scaduto
   */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = this.decodeJWTPayload(token);
      const now = Math.floor(Date.now() / 1000);
      return payload.exp < now;
    } catch {
      return true;
    }
  }

  register(): void {
    const keycloakRegisterUrl = 'http://localhost:8081/realms/yahtzee-realm/protocol/openid-connect/registrations';
    const clientId = 'yahtzee-fe-client';
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
    const responseType = 'code';
    const scope = 'openid profile email';

    const registerUrl = `${keycloakRegisterUrl}?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=${responseType}&scope=${scope}`;

    console.log('Redirecting to Keycloak registration:', registerUrl);
    window.location.href = registerUrl;
  }

  /**
   * Pulisce l'autenticazione locale
   */
  private clearLocalAuth(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('id_token'); // Rimuovi anche l'ID token
    this.tokenSubject.next(null);
  }

  /**
   * Logout silenzioso (solo locale, senza redirect)
   */
  silentLogout(): void {
    console.log('Silent logout - clearing local auth only');
    this.clearLocalAuth()
  }
}
