import {IExtendedWebSocket} from "../types.js";

export const turn = (channel: IExtendedWebSocket, currentPlayer: number | string): void => {
    channel.send(JSON.stringify({
        type: "turn",
        data: JSON.stringify({
            currentPlayer,
        }),
        id: 0,
    }))
}