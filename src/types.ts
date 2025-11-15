import type {WebSocket} from "ws";

export interface IUser {
    name: string,
    index: number | string,
}

export interface IWinner {
    name: string,
    wins: number,
}

export interface IPosition {
    x: number,
    y: number,
}

export interface IParsedData {
    data: string,
    type: string,
    id: number,
}

export interface IShip {
    position: IPosition,
    direction: boolean,
    type: 'large' | 'medium' | 'small' | 'huge',
    length: number,
    shipCoordinates?: IPosition[],
}

export interface IRoomUser extends IUser {
    steps?: Set<string>,
    ships?: IShip[],
    allShips?: IShip[],
}


export interface IRoom {
    roomId: string | number,
    roomUsers: IRoomUser[],
}

export interface IActiveRoom extends IRoom {
    activePlayer: number | string,
}

export interface IExtendedWebSocket extends WebSocket {
    id: number;
}