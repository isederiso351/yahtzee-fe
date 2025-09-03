import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { GameService } from '../services/game.service';
import { WebSocketService } from '../services/websocket.service';
import {GameInfoDTO, GameStatus, GameEventMessage, GameEventType, GameRequest, Page} from '../models/game.models';
import {AuthService} from '../services/auth.service';
import {UserService} from '../services/user.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {

  //Caricamento partite
  games: GameInfoDTO[] = [];
  loading = false;
  isConnected = false;

  // Paginazione
  currentPage = 0;
  pageSize = 12;
  totalElements = 0;
  totalPages = 0;
  hasNextPage = false;

  //Creazione partita
  newGame: GameRequest = {
    max_players: 4,
    bet: 0
  };

  userCredit: number = 0;

  // Gestione sottoscrizioni
  private subscriptions: Subscription[] = [];

  constructor(
    private gameService: GameService,
    private webSocketService: WebSocketService,
    private authService: AuthService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.loadAvailableGames(0, true);
    this.initializeWebSocket();
    this.subscribeToWebSocketEvents();
    this.loadUserCredit();
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
        if(event.game) {
          this.handleGameCreated(event.game)
        }
        break;

      case GameEventType.UPDATED:
        if (event.game) {
          this.handleGameUpdated(event.game)
        }
        break;

      case GameEventType.DELETED:
        // Partita cancellata -> rimuovi
        if (event.gameId) {
          this.handleGameDeleted(event.gameId);
        }
        break;
    }
  }

  private handleGameCreated(game:GameInfoDTO){
    // Nuova partita creata -> aggiungila se è WAITING
    if (game && game.status === GameStatus.WAITING) {
      if(this.currentPage===0) {
        this.games.unshift(game);
        if(this.games.length > this.pageSize) {
          this.games.pop();
        }
      }
      console.log('Added new game:',game.gameId);
      this.totalElements++;
      this.totalPages = Math.ceil(this.totalElements / this.pageSize);
    }
  }

  private handleGameUpdated(game: GameInfoDTO): void {

    const index = this.games.findIndex(g => g.gameId === game!.gameId);

    if (game.status === GameStatus.WAITING) {
      // Ancora in attesa
      if (index >= 0) {
        // Aggiorna esistente
        this.games[index] = game;
        console.log('Updated game:', game.gameId);
      } else if (this.currentPage === 0) {
        // Se non è nella lista e siamo in prima pagina, aggiungila
        this.games.unshift(game);
        if (this.games.length > this.pageSize) {
          this.games.pop();
        }
        console.log('Added updated game to first page:', game.gameId);
      }
    } else {
      this.handleGameDeleted(game.gameId);
    }
  }

  private handleGameDeleted(gameId: number): void {
    const index = this.games.findIndex(g => g.gameId === gameId);
    if (index >= 0) {
      this.games.splice(index, 1);
      this.totalElements--;
      this.totalPages = Math.ceil(this.totalElements / this.pageSize);
      console.log('Removed deleted game:', gameId);

      // Se la pagina è vuota e non è l'ultima, carica la prossima
      if (this.games.length === 0 && this.hasNextPage) {
        this.loadAvailableGames(this.currentPage, false);
      }
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

        this.loadUserCredit();
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
        this.loadUserCredit();

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

  /**
   * ----------------------USER CREDIT---------------------------------------
   */

  private loadUserCredit():void{
    const creditSub = this.userService.getUserCredit().subscribe({
      next: (credit) => {
        this.userCredit = credit;
      },
      error: (error) => {
        console.error('Error loading credit:', error);
        this.userCredit = -1;
      }
    });
    this.subscriptions.push(creditSub);
  }

  canCreateGame(): boolean {
    return this.userCredit >= this.newGame.bet;
  }

  canJoinGame(game: GameInfoDTO): boolean {
    return game.users.length < game.max_players && this.userCredit >= game.bet;
  }
}
