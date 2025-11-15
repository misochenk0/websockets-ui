export interface IUser {
    name: string,
    index: number | string,
}

export interface IRoom {
    roomId: string | number,
    roomUsers: IUser[],
}

export interface IWinner {
    name: string,
    wins: number,
}

export interface IPosition {
    x: number,
    y: number,
}
