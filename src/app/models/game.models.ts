export enum GameStatus {
  COMPLETED = 'COMPLETED',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING = 'WAITING'
}

export enum GameEventType {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED'
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

export interface GameEventMessage {
  type: GameEventType;
  game?: GameInfoDTO;
  gameId?: number;
}



export interface User {
  id: string;
  email: string;
  name: string;
  credit: number;
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
