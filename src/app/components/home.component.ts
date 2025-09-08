import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { GameService } from '../services/game.service';
import { WebSocketService } from '../services/websocket.service';
import {GameInfoDTO, GameStatus, GameEventType, GameRequest, Page} from '../models/game.models';
import {AuthService} from '../services/auth.service';
import {UserService} from '../services/user.service';
import {Router} from '@angular/router';

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

  userName: string = "";
  userCredit: number = 0;

  // Gestione sottoscrizioni
  private subscriptions: Subscription[] = [];

  constructor(
    private gameService: GameService,
    private webSocketService: WebSocketService,
    private authService: AuthService,
    private userService: UserService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadAvailableGames(0, true);
    this.initializeWebSocket();
    this.subscribeToWebSocketEvents();
    this.userName=this.authService.getCurrentUserName();
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
    const gameEventsSub = this.webSocketService.getGameHomeEvents().subscribe(_ => {
      this.loadAvailableGames(this.currentPage);
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
      next: (createdGame) => {
        console.log('Game created successfully');
        this.loading = false;

        // Reset del form
        this.newGame = { max_players: 4, bet: 0 };

        this.router.navigate(['/game',createdGame.gameId])
      },
      error: (error) => {
        console.error('Error creating game:', error);
        this.loading = false;
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
        this.router.navigate(['/game', gameId]);
      },
      error: (error) => {
        console.error('Error joining game:', error);
        this.loading = false;
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
    return game.users.includes(this.userName) || (game.users.length < game.max_players && this.userCredit >= game.bet);
  }
}
