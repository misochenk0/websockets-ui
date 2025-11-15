import { findFirstAvailable, getCoordinatesAround } from "../helpers.js";
import { turn } from "./turn.js";
import {
    IParsedData,
    IPosition,
    IExtendedWebSocket,
    IActiveRoom,
    IAttackResult,
    IAttackError,
    EStatus,
    IUser, IRoomUser, IShip, IWinner
} from "../types.js";
import type { WebSocketServer } from "ws";
import {sendWinners, updateWinners} from "./update_winners.js";

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

let isFinished: boolean = false
let winner: IUser = null

export const attack = (parsedData: IParsedData, activeRooms: IActiveRoom[], wss: WebSocketServer, winners: IWinner[]): IAttackResult | IAttackError => {
    const data: IAttackData = JSON.parse(parsedData?.data)
    const room: IActiveRoom = activeRooms.find(room => room.roomId === data.gameId)
    if (room.activePlayer !== data.indexPlayer) return { error: 'Not your turn' }
    const player: IRoomUser = room.roomUsers.find(user => user.index === data.indexPlayer)
    const enemy: IRoomUser = room.roomUsers.find(user => user.index !== data.indexPlayer)
    let position: IPosition = { x: data.x, y: data.y }
    if (player.steps.has(`${data.x},${data.y}`)) {
        return { error: 'Already shot here' }
    }
    if (parsedData?.type === 'randomAttack') {
        const available: IPosition = findFirstAvailable(player.steps)
        position = { x: available.x, y: available.y }
    }
    const hittedShip: IShip = enemy.allShips.find((ship: IShip): boolean => ship.shipCoordinates.some((shipPosition: IPosition): boolean => shipPosition.x === position.x && shipPosition.y === position.y))
    if (hittedShip) {
        hittedShip.shipCoordinates = hittedShip.shipCoordinates.filter((shipPosition: IPosition) => JSON.stringify(shipPosition) !== JSON.stringify(position))
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
    let response: IAttackResult | IAttackError = null

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
                winner = player
                isFinished = true
            }
            if (room.activePlayer === 'bot') {
                setTimeout(() => {
                    const passedData: IParsedData = { type: 'randomAttack', data: JSON.stringify({ gameId: data.gameId, indexPlayer: turnUser }), id: 0 }
                    response = attack(passedData, activeRooms, wss, winners) as IAttackResult
                    if (response.isFinished) {
                        let activeUsers = activeRooms.find((room: IActiveRoom): boolean => room.roomId === data.gameId)?.roomUsers
                        activeRooms = activeRooms.filter((room: IActiveRoom): boolean => room.roomId !== data.gameId)
                        winners = updateWinners(response.winner, winners)

                        wss.clients.forEach((client : IExtendedWebSocket): void => {
                            if (activeUsers.some((user: IRoomUser): boolean => user.index === client.id)) {
                                if ('winner' in response) {
                                    client.send(JSON.stringify({
                                        type: "finish",
                                        data: JSON.stringify({
                                            winPlayer: response.winner.index,
                                        }),
                                        id: 0,
                                    }))
                                }
                            }
                            sendWinners(client, winners)
                        })
                    }
                }, 1000)
            }
        }
    })
    return response || {
        status,
        position,
        isFinished,
        winner,
    }
}