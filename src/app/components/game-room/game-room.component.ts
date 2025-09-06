import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {CommonModule} from '@angular/common';
import {Subscription} from 'rxjs';
import {GameService} from '../../services/game.service';
import {WebSocketService} from '../../services/websocket.service';
import {AuthService} from '../../services/auth.service';
import {GameEventType, GameInfoDTO, GameRoomEventMessage} from '../../models/game.models';

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
    const currentUser = this.authService.getCurrentUserName()
    this.isHost = this.game?.host === currentUser;
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
    const gameEventsSub = this.webSocketService.subscribeToGameRoom(this.gameId).subscribe(event => {
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

    switch (event.type) {
      case GameEventType.JOINED:
        if (event.game) {
          this.game = event.game;
          this.checkCanStartGame()

        }
        break;

      case GameEventType.ROLLED:
        if (event.game) {
          this.game = event.game;
          //this.showDiceResults(event.playerName, event.diceResult);
        }
        break;

      case GameEventType.STARTED:
        if (event.game) {
          this.game = event.game;
          this.showNotification('La partita è iniziata!');
          //this.startGameAnimation();
        }
        break;

      default:
        console.log('Unknown game room event:', event.type);
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

    // Mantieni solo le ultime 3
    if (this.notifications.length > 3) {
      this.notifications = this.notifications.slice(0, 3);
    }

    // Rimuovi dopo 4 secondi
    setTimeout(() => {
      const index = this.notifications.indexOf(message);
      if (index !== -1) {
        this.notifications.splice(index, 1);
      }
    }, 4000);
  }
}
