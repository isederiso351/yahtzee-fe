import { Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameEventMessage } from '../models/game.models';
import SockJS from 'sockjs-client';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private stompClient: Client;

  // Subject per gli eventi di gioco (Home e Lobby)
  private gameEventsSubject = new BehaviorSubject<GameEventMessage | null>(null);

  // Subject per lo stato della connessione
  private connectionStateSubject = new BehaviorSubject<boolean>(false);

  constructor(){
    this.stompClient = new Client({
      webSocketFactory: () => new SockJS('/ws'),

      debug: (str) => {
        console.log('🔌 WebSocket Debug:', str);
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
      this.subscribeToGameEvents();
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


  private subscribeToGameEvents(): void {
    this.stompClient.subscribe('/topic/games', (message: IMessage) => {
      try {
        const gameEvent: GameEventMessage = JSON.parse(message.body);
        console.log('Received game event:', gameEvent);
        this.gameEventsSubject.next(gameEvent);
      } catch (error) {
        console.error('Error parsing game event:', error);
      }
    });
  }

  getGameEvents(): Observable<GameEventMessage | null> {
    return this.gameEventsSubject.asObservable();
  }

  getConnectionState(): Observable<boolean> {
    return this.connectionStateSubject.asObservable();
  }

  isConnected(): boolean {
    return this.stompClient.active;
  }

  reconnect(): void {
    this.disconnect();
    setTimeout(() => {
      this.connect();
    }, 1000);
  }
}
