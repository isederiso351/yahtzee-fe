export enum GameStatus {
  COMPLETED = 'COMPLETED',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING = 'WAITING'
}

export enum GameEventType {
  JOINED = 'PLAYER_JOINED',
  STARTED = 'GAME_STARTED',
  ROLLED = 'DICE_ROLLED',
  COMPLETED = 'GAME_COMPLETED'
}


export interface GameInfoDTO {
  gameId: number;
  host: string;
  status: GameStatus;
  users: string[];
  max_players: number;
  bet: number;
  currentRoll?: number;
  currentDiceResults?: {[username:string]:number};
  activePlayers?: string[];
  winner?: string;
}

export interface GameRequest {
  max_players: number;
  bet: number;
}

export interface GameRoomEventMessage {
  type: GameEventType;
  game?: GameInfoDTO;
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
