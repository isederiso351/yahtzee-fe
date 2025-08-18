import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { GameService } from '../services/game.service';
import { WebSocketService } from '../services/websocket.service';
import { GameInfoDTO, GameStatus, GameEventMessage, GameEventType, GameRequest } from '../models/game.models';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {

  games: GameInfoDTO[] = [];
  loading = false;
  isConnected = false;

  newGame: GameRequest = {
    max_players: 4,
    bet: 0
  };

  // Gestione sottoscrizioni
  private subscriptions: Subscription[] = [];

  constructor(
    private gameService: GameService,
    private webSocketService: WebSocketService
  ) {}

  ngOnInit(): void {

    this.loadAvailableGames();
    this.initializeWebSocket();
    this.subscribeToWebSocketEvents();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Inizializza la connessione WebSocket
   */
  private initializeWebSocket(): void {
    this.webSocketService.connect();
  }

  /**
   * Si sottoscrive agli eventi WebSocket
   */
  private subscribeToWebSocketEvents(): void {
    const connectionSub = this.webSocketService.getConnectionState().subscribe(connected => {
      this.isConnected = connected;
    });
    this.subscriptions.push(connectionSub);

    // Eventi di gioco
    const gameEventsSub = this.webSocketService.getGameEvents().subscribe(event => {
      if (event) {
        this.handleGameEvent(event);
      }
    });
    this.subscriptions.push(gameEventsSub);
  }

  /**
   * Carica le partite disponibili (status = WAITING)
   */
  private loadAvailableGames(): void {
    this.loading = true;

    const gamesSub = this.gameService.getGames(GameStatus.WAITING).subscribe({
      next: (page) => {
        this.games = page.content;
        this.loading = false;
        console.log('Loaded', this.games.length, 'available games');
      },
      error: (error) => {
        console.error('Error loading games:', error);
        this.loading = false;
      }
    });

    this.subscriptions.push(gamesSub);
  }

  /**
   * Gestisce gli eventi WebSocket in tempo reale
   */
  private handleGameEvent(event: GameEventMessage): void {
    console.log('Handling game event:', event);

    switch (event.type) {
      case GameEventType.CREATED:
        // Nuova partita creata -> aggiungila se è WAITING
        if (event.game && event.game.status === GameStatus.WAITING) {
          this.games.unshift(event.game);
          console.log('Added new game:', event.game.gameId);
        }
        break;

      case GameEventType.UPDATED:
        // Partita aggiornata -> aggiorna o rimuovi
        if (event.game) {
          const index = this.games.findIndex(g => g.gameId === event.game!.gameId);

          if (event.game.status === GameStatus.WAITING) {
            // Ancora in attesa -> aggiorna
            if (index >= 0) {
              this.games[index] = event.game;
              console.log('Updated game:', event.game.gameId);
            } else {
              // Non era nella lista -> aggiungila
              this.games.unshift(event.game);
              console.log('Added updated game:', event.game.gameId);
            }
          } else {
            // Non più in attesa (iniziata) -> rimuovi dalla lista
            if (index >= 0) {
              this.games.splice(index, 1);
              console.log('Game started, removed from list:', event.game.gameId);
            }
          }
        }
        break;

      case GameEventType.DELETED:
        // Partita cancellata -> rimuovi
        if (event.gameId) {
          this.games = this.games.filter(g => g.gameId !== event.gameId);
          console.log('Removed deleted game:', event.gameId);
        }
        break;
    }
  }

  /**
   * Crea una nuova partita
   */
  createGame(): void {
    this.loading = true;

    const createSub = this.gameService.createGame(this.newGame).subscribe({
      next: () => {
        console.log('Game created successfully');
        this.loading = false;

        // Reset del form
        this.newGame = { max_players: 4, bet: 0 };
      },
      error: (error) => {
        console.error('Error creating game:', error);
        this.loading = false;
        // TODO: Mostra messaggio di errore all'utente
      }
    });

    this.subscriptions.push(createSub);
  }

  /**
   * Entra in una partita esistente
   */
  joinGame(gameId: number): void {
    this.loading = true;

    const joinSub = this.gameService.joinGame(gameId).subscribe({
      next: () => {
        console.log('Joined game successfully:', gameId);
        this.loading = false;

        // TODO: Naviga alla schermata Lobby
        // this.router.navigate(['/lobby', gameId]);
      },
      error: (error) => {
        console.error('Error joining game:', error);
        this.loading = false;
        // TODO: Mostra messaggio di errore all'utente
      }
    });

    this.subscriptions.push(joinSub);
  }

  /**
   * Determina la classe CSS per il contatore giocatori
   */
  getPlayersClass(game: GameInfoDTO): string {
    const ratio = game.users.length / game.max_players;
    if (ratio >= 1) return 'text-danger fw-bold';
    if (ratio >= 0.8) return 'text-warning fw-bold';
    return 'text-success fw-bold';
  }
}
