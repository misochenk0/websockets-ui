import {IExtendedWebSocket, IUser} from "../types.js";

export const error = (ws: IExtendedWebSocket, activeUser: IUser, text: string): void => {
    ws.send(JSON.stringify({
        type: 'reg',
        data: JSON.stringify({
            name: activeUser.name,
            index: activeUser.index,
            error: true,
            errorText: text,
        }),
        id: ws.id,
    }));
}