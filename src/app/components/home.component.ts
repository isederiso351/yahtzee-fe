import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { GameService } from '../services/game.service';
import { WebSocketService } from '../services/websocket.service';
import {GameInfoDTO, GameStatus, GameEventMessage, GameEventType, GameRequest, Page} from '../models/game.models';
import {AuthService} from '../services/auth.service';

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

  // Paginazione
  currentPage = 0;
  pageSize = 12;
  totalElements = 0;
  totalPages = 0;
  hasNextPage = false;

  newGame: GameRequest = {
    max_players: 4,
    bet: 0
  };

  // Gestione sottoscrizioni
  private subscriptions: Subscription[] = [];
  private currentPageData: Page<GameInfoDTO> | null = null;

  constructor(
    private gameService: GameService,
    private webSocketService: WebSocketService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {

    this.loadAvailableGames(0, true);
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
  private loadAvailableGames(page: number, reset: boolean = false): void {
    this.loading = true;
    if (reset) {
      this.games = [];
      this.currentPage = 0;
    }

    const gamesSub = this.gameService.getGames(GameStatus.WAITING, page, this.pageSize).subscribe({
      next: (pageData) => {
        this.currentPageData = pageData;
        this.totalElements = pageData.totalElements;
        this.totalPages = pageData.totalPages;
        this.hasNextPage = !pageData.last;


        this.games = pageData.content;

        this.currentPage = page;
        this.loading = false;

        console.log(`Loaded page ${page + 1}/${this.totalPages} (${pageData.content.length} games)`);
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
          if(this.currentPage===0) {
            this.games.unshift(event.game);
            if(this.games.length > this.pageSize) {
              this.games.pop();
            }
          }
          console.log('Added new game:', event.game.gameId);
          this.totalElements++;
          this.totalPages = Math.ceil(this.totalElements / this.pageSize);
        }
        break;

      case GameEventType.UPDATED:
        // Partita aggiornata -> aggiorna o rimuovi
        if (event.game) {
          const index = this.games.findIndex(g => g.gameId === event.game!.gameId);

          if (event.game.status === GameStatus.WAITING) {
            // Ancora in attesa
            if (index >= 0) {
              // Aggiorna esistente
              this.games[index] = event.game;
              console.log('Updated game:', event.game.gameId);
            } else if (this.currentPage === 0) {
              // Se non è nella lista e siamo in prima pagina, aggiungila
              this.games.unshift(event.game);
              if (this.games.length > this.pageSize) {
                this.games.pop();
              }
              console.log('Added updated game to first page:', event.game.gameId);
            }
          } else {
            // Non più in attesa - rimuovi dalla lista
            if (index >= 0) {
              this.games.splice(index, 1);
              this.totalElements--;
              this.totalPages = Math.ceil(this.totalElements / this.pageSize);
              console.log('Game started, removed from list:', event.game.gameId);

              // Se la pagina è vuota e non è l'ultima, carica la prossima
              if (this.games.length === 0 && this.hasNextPage) {
                this.loadAvailableGames(this.currentPage, false);
              }
            }
          }
        }
        break;

      case GameEventType.DELETED:
        // Partita cancellata -> rimuovi
        if (event.gameId) {
          const index = this.games.findIndex(g => g.gameId === event.gameId);
          if (index >= 0) {
            this.games.splice(index, 1);
            this.totalElements--;
            this.totalPages = Math.ceil(this.totalElements / this.pageSize);
            console.log('Removed deleted game:', event.gameId);

            // Se la pagina è vuota e non è l'ultima, carica la prossima
            if (this.games.length === 0 && this.hasNextPage) {
              this.loadAvailableGames(this.currentPage, false);
            }
          }
        }
        break;
    }
  }

  /**
   * Va alla pagina successiva
   */
  goToNextPage(): void {
    if (this.hasNextPage && !this.loading) {
      this.loadAvailableGames(this.currentPage + 1, false);
    }
  }

  /**
   * Va alla pagina precedente
   */
  goToPrevPage(): void {
    if (this.currentPage > 0 && !this.loading) {
      this.loadAvailableGames(this.currentPage - 1, false);
    }
  }

  /**
   * Ricarica dall'inizio
   */
  refresh(): void {
    this.loadAvailableGames(0, true);
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

  logout(): void {
    this.authService.logout();
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

  protected readonly Math = Math;
}
