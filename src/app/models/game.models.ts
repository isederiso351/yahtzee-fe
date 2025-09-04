export enum GameStatus {
  COMPLETED = 'COMPLETED',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING = 'WAITING'
}

export enum GameEventType {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',
  JOINED = 'PLAYER_JOINED',
  STARTED = 'GAME_STARTED',
  ROLLED = 'DICE_ROLLED'
}


export interface GameInfoDTO {
  gameId: number;
  host: string;
  status: GameStatus;
  users: string[];
  max_players: number;
  bet: number;
}

export interface GameRequest {
  max_players: number;
  bet: number;
}

export interface GameHomeEventMessage {
  type: GameEventType;
  game?: GameInfoDTO;
  gameId?: number;
}

export interface GameRoomEventMessage {
  type: GameEventType;
  game?: GameInfoDTO;
  playerName?: string;
  diceResult?: string;
}


export interface Page<T> {
  content: T[];
  pageable: {
    pageNumber: number;
    pageSize: number;
  };
  totalElements: number;
  totalPages: number;
  last: boolean;
  first: boolean;
}
