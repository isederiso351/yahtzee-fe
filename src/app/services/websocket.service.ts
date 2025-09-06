import { Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameRoomEventMessage} from '../models/game.models';
import SockJS from 'sockjs-client';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private stompClient: Client;

  // Subject per gli eventi di gioco (Home)
  private gameHomeEventsSubject = new BehaviorSubject<void>(undefined);

  // Subject per gli eventi di specifiche partite
  private gameRoomEventsSubject = new BehaviorSubject<GameRoomEventMessage | null>(null);

  // Subject per lo stato della connessione
  private connectionStateSubject = new BehaviorSubject<boolean>(false);

  private currentGameSubscription: any;

  constructor(){
    this.stompClient = new Client({
      webSocketFactory: () => new SockJS('/ws'),

      debug: (str) => {
        console.log('WebSocket Debug:', str);
      },

      // Configurazione riconnessione automatica
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    // Callback quando si connette
    this.stompClient.onConnect = (frame) => {
      console.log('Connected to WebSocket:', frame);
      this.connectionStateSubject.next(true);
      this.subscribeToGameHomeEvents();
    };

    // Callback quando si disconnette
    this.stompClient.onDisconnect = (frame) => {
      console.log('Disconnected from WebSocket:', frame);
      this.connectionStateSubject.next(false);
    };

    // Callback per errori
    this.stompClient.onStompError = (frame) => {
      console.error('WebSocket error:', frame.headers['message']);
      console.error('Details:', frame.body);
    };
  }


  connect(): void {
    if (!this.stompClient.active) {
      console.log('Connecting to WebSocket...');
      this.stompClient.activate();
    }
  }

  disconnect(): void {
    if (this.stompClient.active) {
      console.log('Disconnecting from WebSocket...');
      this.stompClient.deactivate();
    }
  }


  private subscribeToGameHomeEvents(): void {
    this.stompClient.subscribe('/topic/games', (_) => {
        console.log('Received game event');
        this.gameHomeEventsSubject.next();
    });
  }

  subscribeToGameRoomEvents(gameId: number): Observable<GameRoomEventMessage | null> {
    // Unsubscribe dalla partita precedente se c'è
    this.unsubscribeFromCurrentGame();
    this.gameRoomEventsSubject.next(null);

    // Subscribe alla nuova partita
    const topic = `/topic/game/${gameId}`;
    this.currentGameSubscription = this.stompClient.subscribe(topic, (message) => {
      const event: GameRoomEventMessage = JSON.parse(message.body);
      this.gameRoomEventsSubject.next(event);
    });

    return this.gameRoomEventsSubject.asObservable();
  }

  unsubscribeFromCurrentGame(): void {
    if (this.currentGameSubscription) {
      this.currentGameSubscription.unsubscribe();
      this.currentGameSubscription = null;
    }
  }

  getGameHomeEvents(): Observable<void> {
    return this.gameHomeEventsSubject.asObservable();
  }

  getConnectionState(): Observable<boolean> {
    return this.connectionStateSubject.asObservable();
  }
}
