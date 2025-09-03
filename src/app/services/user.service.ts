import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly baseUrl = '/api/user';

  constructor(private http: HttpClient) {}

  getUserCredit(): Observable<number> {
    return this.http.get<number>(`${this.baseUrl}/credit`);
  }
}
