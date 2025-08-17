import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GameInfoDTO, GameRequest, GameStatus, Page } from '../models/game.models';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private readonly baseUrl = '/api/game';

  constructor(private http: HttpClient) {}

  getGames(status: GameStatus, page: number = 0, size: number = 10): Observable<Page<GameInfoDTO>> {
    const params = new HttpParams()
      .set('status', status)
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<Page<GameInfoDTO>>(this.baseUrl, { params });
  }

  createGame(gameRequest: GameRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/create`, gameRequest);
  }


  joinGame(gameId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${gameId}/join`, {});
  }


  leaveGame(gameId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${gameId}/leave`, {});
  }
}
