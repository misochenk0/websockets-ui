import { findFirstAvailable, getCoordinatesAround } from "../helpers.js";
import { updateWinners } from "./update_winners.js";
import { turn } from "./turn.js";
import {IParsedData, IPosition, IExtendedWebSocket, IActiveRoom, IAttackResult, IAttackError, EStatus} from "../types.js";
import type { WebSocketServer } from "ws";

interface IAttackData {
    indexPlayer: number,
    gameId: number,
    x?: number,
    y?: number,
}

const sendAttack = (client: IExtendedWebSocket, currentPlayer: number, position: IPosition, status: EStatus): void => {
    client.send(JSON.stringify({
        type: "attack",
        data: JSON.stringify({
            position,
            currentPlayer,
            status,
        }),
        id: 0,
    }))
}

export const attack = (parsedData: IParsedData, activeRooms: IActiveRoom[], wss: WebSocketServer): IAttackResult | IAttackError => {
    const data: IAttackData = JSON.parse(parsedData?.data)
    const room = activeRooms.find(room => room.roomId === data.gameId)
    if (room.activePlayer !== data.indexPlayer) return { error: 'Not your turn' }
    const player = room.roomUsers.find(user => user.index === data.indexPlayer)
    const enemy = room.roomUsers.find(user => user.index !== data.indexPlayer)
    let position: IPosition = { x: data.x, y: data.y }

    if (parsedData?.type === 'randomAttack') {
        const available: IPosition = findFirstAvailable(player.steps)
        position = { x: available.x, y: available.y }
    }
    const hittedShip = enemy.allShips.find(ship => ship.shipCoordinates.some(shipPosition => shipPosition.x === position.x && shipPosition.y === position.y))
    if (hittedShip) {
        hittedShip.shipCoordinates = hittedShip.shipCoordinates.filter(shipPosition => JSON.stringify(shipPosition) !== JSON.stringify(position))
    }
    let status: EStatus = null
    let turnUser: string | number = player.index

    switch (true) {
        case hittedShip?.shipCoordinates?.length === 0:
            status = EStatus.killed
            break;
        case hittedShip?.shipCoordinates?.length > 0:
            status = EStatus.shot
            break;
        default:
            status = EStatus.miss
            turnUser = enemy.index
            break;
    }

    wss.clients.forEach((client: IExtendedWebSocket): void => {
        if (room.roomUsers.some(user => user.index === client.id)) {
            sendAttack(client, data.indexPlayer, position, status)
            player.steps.add(`${position.x},${position.y}`)
            if (status === EStatus.killed) {
                enemy.allShips = enemy.allShips.filter(ship => JSON.stringify(ship.position) !== JSON.stringify(hittedShip.position))
                const coordinatesAround: IPosition[] = getCoordinatesAround(hittedShip)
                coordinatesAround.forEach((position: IPosition): void => {
                    sendAttack(client, data.indexPlayer, position, EStatus.miss)
                    player.steps.add(`${position.x},${position.y}`)
                })
            }
            turn(client, turnUser)
            room.activePlayer = turnUser
            if (enemy.allShips.length === 0) {
                client.send(JSON.stringify({
                    type: "finish",
                    data: JSON.stringify({
                        winPlayer: player.index,
                    }),
                    id: 0,
                }))
                updateWinners(player, client)
            }
            if (room.activePlayer === 'bot') {
                setTimeout(() => {
                    const passedData: IParsedData = { type: 'randomAttack', data: JSON.stringify({ gameId: data.gameId, indexPlayer: turnUser }), id: 0 }
                    attack(passedData, activeRooms, wss)
                }, 1000)
            }
        }
    })
    return {
        status,
        position,
    }
}