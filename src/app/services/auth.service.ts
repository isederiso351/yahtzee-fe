import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {BehaviorSubject, catchError, Observable, of, tap} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private tokenSubject = new BehaviorSubject<string | null>(null);
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);
  private refreshTimer:any;

  private keycloakBaseUrl="http://localhost:8081"

  constructor(private http: HttpClient) {
    // Carica il token salvato al bootstrap
    const savedToken = localStorage.getItem('access_token');
    const savedRefreshToken = localStorage.getItem('refresh_token');

    if (savedToken && !this.isTokenExpired(savedToken)) {
      this.tokenSubject.next(savedToken);
      this.refreshTokenSubject.next(savedRefreshToken);
      this.scheduleTokenRefresh(savedToken);
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

  getCurrentUserName(){
    const token = this.getCurrentToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));

        return payload.preferred_username;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Inizia il processo di login con Keycloak
   */
  login(): void {
    const keycloakUrl = `${this.keycloakBaseUrl}/realms/yahtzee-realm/protocol/openid-connect/auth`;
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
    const tokenUrl = `${this.keycloakBaseUrl}/realms/yahtzee-realm/protocol/openid-connect/token`;

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
  setTokens(access_token: string, id_token: string, refresh_token?:string): void {
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('id_token', id_token);
    if(refresh_token) {
      localStorage.setItem('refresh_token', refresh_token);
      this.refreshTokenSubject.next(refresh_token);
    }
    this.tokenSubject.next(access_token);
    this.scheduleTokenRefresh(access_token);
  }

  /**
   * Effettua il logout
   */
  logout(): void {


    const keycloakLogoutUrl = `${this.keycloakBaseUrl}/realms/yahtzee-realm/protocol/openid-connect/logout`;
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
   * Rinnova il token usando il refresh token
   */
  refreshToken(): Observable<any> {
    const refreshToken = this.refreshTokenSubject.value || localStorage.getItem('refresh_token');

    if (!refreshToken) {
      this.logout();
      return of(null);
    }

    const tokenUrl = `${this.keycloakBaseUrl}/realms/yahtzee-realm/protocol/openid-connect/token`;

    const body = new URLSearchParams();
    body.set('grant_type', 'refresh_token');
    body.set('client_id', 'yahtzee-fe-client');
    body.set('refresh_token', refreshToken);

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    return this.http.post<any>(tokenUrl, body.toString(), { headers }).pipe(
      tap(response => {
        // Aggiorna i token
        this.setTokens(response.access_token, response.id_token, response.refresh_token);
        console.log('Token refreshed successfully');
      }),
      catchError((error) => {
        console.error('Token refresh failed:', error);
        this.logout();
        return of(null);
      })
    );
  }

  /**
   * Programma il rinnovo automatico del token
   */
  private scheduleTokenRefresh(token: string): void {
    try {
      const payload = this.decodeJWTPayload(token);

      const expirationTime = payload.exp * 1000; // Converti in millisecondi
      const now = Date.now();
      const refreshTime = expirationTime - now - (5 * 60 * 1000); // Rinnova 5 minuti prima della scadenza

      if (refreshTime > 0) {
        console.log(`Token refresh scheduled in ${Math.floor(refreshTime / 1000)} seconds`);

        if (this.refreshTimer) {
          clearTimeout(this.refreshTimer);
        }
        this.refreshTimer = setTimeout(() => {
          console.log('Auto-refreshing token...');
          this.refreshToken().subscribe();
        }, refreshTime);
      } else {
        // Token già scaduto o scade a breve, rinnova immediatamente
        console.log('Token expired or expiring soon, refreshing immediately');
        this.refreshToken().subscribe();
      }
    } catch (error) {
      console.error('Error scheduling token refresh:', error);
    }
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
    const keycloakRegisterUrl = `${this.keycloakBaseUrl}/realms/yahtzee-realm/protocol/openid-connect/registrations`;
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
}
