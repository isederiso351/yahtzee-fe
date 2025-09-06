import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {CommonModule} from '@angular/common';
import {Subscription} from 'rxjs';
import {GameService} from '../../services/game.service';
import {WebSocketService} from '../../services/websocket.service';
import {AuthService} from '../../services/auth.service';
import {GameEventType, GameInfoDTO, GameRoomEventMessage, GameStatus} from '../../models/game.models';

@Component({
  selector: 'app-game-room',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-room.component.html',
  styleUrls: ['./game-room.component.css']
})
export class GameRoomComponent implements OnInit, OnDestroy {

  gameId!: number;
  game: GameInfoDTO | null = null;
  loading = true;

  // Stato del gioco
  isHost = false;
  canStartGame = false;

  // Stato dei dadi
  diceAnimation = false;
  showResults = false;

  currentUsername: string|null = null;

  notifications: string[] = [];

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gameService: GameService,
    private webSocketService: WebSocketService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.gameId = +this.route.snapshot.params['id'];
    this.notifications = [];

    if (!this.gameId) {
      this.router.navigate(['/']);
      return;
    }

    this.loadGameInfo();
    this.subscribeToGameEvents();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.webSocketService.unsubscribeFromCurrentGame();
  }

  /**
   * Carica le informazioni della partita
   */
  private loadGameInfo(): void {
    this.loading = true;

    const gameSub = this.gameService.getGame(this.gameId).subscribe({
      next: (response) => {
        if (!response.gameId) {
          console.error('Game not found:', this.gameId);
          this.router.navigate(['/']);
          return;
        }

        this.game = response;
        this.currentUsername = this.authService.getCurrentUserName()
        this.checkIfHost();
        this.checkCanStartGame();
        this.loading = false;

        console.log('Game loaded:', this.game);
      },
      error: (error) => {
        console.error('Error loading game:', error);
        this.router.navigate(['/']);
      }
    });

    this.subscriptions.push(gameSub);
  }

  /**
   * Controlla se l'utente corrente è l'host
   */
  private checkIfHost(): void {
    this.isHost = this.game?.host === this.currentUsername;
  }

  /**
   * Controlla se si può iniziare la partita
   */
  private checkCanStartGame(): void {
    this.canStartGame = this.isHost &&
      this.game !== null
  }

  /**
   * Si sottoscrive agli eventi della partita
   */
  private subscribeToGameEvents(): void {
    const gameEventsSub = this.webSocketService.subscribeToGameRoomEvents(this.gameId).subscribe(event => {
      if (event) {
        this.handleGameEvent(event);
      }
    });

    this.subscriptions.push(gameEventsSub);
  }

  /**
   * Gestisce gli eventi WebSocket della partita
   */
  private handleGameEvent(event: GameRoomEventMessage): void {
    console.log('Game room received event:', event);
    if(event.game){
      this.game = event.game;
    }

    if(event.type === GameEventType.ROLLED){
      this.handleDiceRolled(event);
    }else if (event.type === GameEventType.COMPLETED){
      this.handleGameCompleted(event);
    }
  }

  private handleDiceRolled(event: GameRoomEventMessage): void {
    if (event.game) {
      this.game = event.game;
      this.showResults = false;

      // Inizia l'animazione dei dadi
      this.diceAnimation = true;
      this.showNotification(`Tiro ${event.game.currentRoll} - I dadi stanno girando...`);

      // Dopo 2 secondi mostra i risultati
      setTimeout(() => {
        this.diceAnimation = false;
        this.showResults = true;
        this.showDiceResults(event.game!.currentDiceResults!);
      }, 2000);
    }
  }

  /**
   * Gestisce il completamento della partita
   */
  private handleGameCompleted(event: GameRoomEventMessage): void {
    if (event.game) {
      this.game = event.game;
      this.showResults = true;
      this.diceAnimation = false;
      this.showNotification(`🎉 ${event.game.winner} ha vinto la partita!`);
    }
  }

  private showDiceResults(results: { [username: string]: number }): void {
    const resultsText = Object.entries(results)
      .map(([user, value]) => `${user}: ${value}`)
      .join(', ');

    const maxValue = Math.max(...Object.values(results));
    const winners = Object.entries(results)
      .filter(([, value]) => value === maxValue)
      .map(([user]) => user);

    if (winners.length === 1) {
      this.showNotification(`Risultati: ${resultsText}. ${winners[0]} ha il punteggio più alto!`);
    } else {
      this.showNotification(`Risultati: ${resultsText}. Pareggio! Nuovo tiro in arrivo...`);
    }
  }

  /**
   * Avvia la partita (solo host)
   */
  startGame(): void {
    if (!this.canStartGame) return;

    this.loading = true;

    const startSub = this.gameService.startGame(this.gameId).subscribe({
      next: () => {
        console.log('Game started successfully');
        this.loading = false;
      },
      error: (error) => {
        console.error('Error starting game:', error);
        this.loading = false;
      }
    });

    this.subscriptions.push(startSub);
  }

  /**
   * Lascia la partita
   */
  leaveGame(): void {
    this.loading = true;

    const leaveSub = this.gameService.leaveGame(this.gameId).subscribe({
      next: () => {
        console.log('Left game successfully');
        this.router.navigate(['/']);
      },
      error: (error) => {
        console.error('Error leaving game:', error);
        this.loading = false;
      }
    });

    this.subscriptions.push(leaveSub);
  }

  /**
   * Torna alla home
   */
  goHome(): void {
    this.router.navigate(['/']);
  }

  getEmptySlots(): number[] {
    if (!this.game) return [];
    const emptyCount = this.game.max_players - this.game.users.length;
    return Array(emptyCount).fill(0);
  }

  private showNotification(message: string): void {
    console.log('Notification:', message);

    this.notifications.unshift(message);

    // Mantieni solo le ultime 5
    if (this.notifications.length >5 ) {
      this.notifications = this.notifications.slice(0, 3);
    }
  }

  /**
   * Ottiene l'icona del dado basata sul valore
   */
  getDiceIcon(value: number): string {
    const diceIcons = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    return diceIcons[value - 1] || '?';
  }

  /**
   * Controlla se un giocatore è tra quelli attivi
   */
  isPlayerActive(playerName: string): boolean {
    return this.game?.activePlayersInRound?.includes(playerName) ?? true;
  }

  protected readonly GameStatus = GameStatus;
}
