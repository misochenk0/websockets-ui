import { httpServer } from "./src/http_server/index.js";
import { WebSocketServer } from 'ws';
import {
    IRoom,
    IParsedData,
    IRoomUser,
    IUser,
    IShip,
    IPosition,
    IExtendedWebSocket,
    IActiveRoom,
    IAttackError,
    IAttackResult,
    IWinner
} from "./src/types.js";
import {sendWinners, updateWinners} from "./src/actions/update_winners.js";
import { attack } from "./src/actions/attack.js";
import { turn } from "./src/actions/turn.js";
import { error } from "./src/actions/error.js";

const HTTP_PORT: number = 8181;

const registeredUsers: IUser[] = []

const wss = new WebSocketServer({ port: 3000 });
let index: number = 0

let availableRooms: IRoom[] = []
let activeRooms: IActiveRoom[] = []
let winners: IWinner[] = []

wss.on('connection', (ws: IExtendedWebSocket): void => {
    console.log('Websockets server started on ws://localhost:3000')
    let userName: string = null
    ws.id = index
    index++
    let activeUser: IUser = { name: userName, password: '', index: ws.id}
    ws.on('error', (): void => {
        error(ws, activeUser, 'Connection error')
    });
    ws.on('message', function message(data: string): void {
        const parsedData: IParsedData = JSON.parse(data);
        const messageType: string = parsedData?.type;

        const updateRooms = (channel: IExtendedWebSocket = ws): void => {
            channel.send(JSON.stringify({
                type: "update_room",
                data: JSON.stringify(availableRooms.filter((room: IRoom): boolean => room.roomUsers.length < 2)),
                id: 0,
            }))
        }

        switch (messageType) {
            case 'reg': {
                const data = JSON.parse(parsedData?.data)
                const userName = data?.name;
                const registeredUser = registeredUsers.find(user => user.name === userName)
                if (registeredUser) {
                    if (registeredUser.password !== data.password) {
                        error(ws, { name: userName, index: ws.id }, 'Wrong password')
                        console.log(`Reg command received from client: User: ${activeUser.name} wrong password`)
                        return
                    }
                    activeUser = registeredUser
                    ws.id = activeUser.index
                    ws.send(JSON.stringify({
                        type: "reg",
                        data: JSON.stringify({
                            name: activeUser.name,
                            index: activeUser.index,
                            error: false,
                        }),
                        id: 0,
                    }));
                    console.log(`Reg command received from client: User: ${activeUser.name} with id: ${activeUser.index} logged in`)
                    return
                }
                activeUser = { name: userName, password: data.password, index: registeredUsers.length }
                ws.id = activeUser.index
                registeredUsers.push(activeUser)
                ws.send(JSON.stringify({
                    type: "reg",
                    data: JSON.stringify({
                        name: activeUser.name,
                        index: activeUser.index,
                        error: false,
                    }),
                    id: 0,
                }));
                console.log(`Reg command received from client: User: ${activeUser.name} with id: ${activeUser.index} created`)

                updateRooms()
                sendWinners(ws, winners)
                break;
            }
            case 'create_room': {
                const new_room = { roomId: availableRooms.length + 1, roomUsers: [activeUser] }
                availableRooms.push(new_room)
                wss.clients.forEach((client: IExtendedWebSocket): void => {
                    updateRooms(client)
                })
                console.log(`Create room command received from client: Room with id: ${new_room.roomId} created`)
                break
            }
            case 'add_user_to_room': {
                const data: { indexRoom: number } = JSON.parse(parsedData?.data)
                const indexRoom: number  = data?.indexRoom
                availableRooms = availableRooms?.map((room: IRoom): IRoom => ({
                    ...room,
                    roomUsers: indexRoom === room.roomId ? [...room.roomUsers, activeUser] : room.roomUsers,
                }))
                const selectedRoom: IRoom = availableRooms.find((room: IRoom): boolean => room.roomId === indexRoom)
                wss.clients.forEach((client: IExtendedWebSocket): void => {
                    updateRooms(client)
                })
                console.log(`Add user to room command received from client: User: ${activeUser.name} with id: ${activeUser.index} added to room with id: ${indexRoom}`)

                if (selectedRoom.roomUsers.length === 2) {
                    activeRooms.push(selectedRoom as IActiveRoom)
                    wss.clients.forEach((client: IExtendedWebSocket): void => {
                        if (selectedRoom.roomUsers.some((user: IRoomUser): boolean => user.index === client.id)) {
                            client.send(JSON.stringify({
                                type: "create_game",
                                data: JSON.stringify({
                                    idGame: selectedRoom.roomId,
                                    idPlayer: client.id,
                                }),
                                id: 0,
                            }))
                        }
                    })
                    console.log(`Game created for room with id: ${selectedRoom.roomId}`)
                }
                break
            }
            case 'single_play': {
                const user: IUser = activeUser
                const bot: IRoomUser = {
                    name: 'Bot',
                    index: 'bot',
                    ships: [
                        {
                            "position": {
                                "x": 8,
                                "y": 2
                            },
                            "direction": true,
                            "type": "huge",
                            "length": 4
                        },
                        {
                            "position": {
                                "x": 2,
                                "y": 5
                            },
                            "direction": false,
                            "type": "large",
                            "length": 3
                        },
                        {
                            "position": {
                                "x": 1,
                                "y": 9
                            },
                            "direction": false,
                            "type": "large",
                            "length": 3
                        },
                        {
                            "position": {
                                "x": 2,
                                "y": 0
                            },
                            "direction": true,
                            "type": "medium",
                            "length": 2
                        },
                        {
                            "position": {
                                "x": 0,
                                "y": 7
                            },
                            "direction": false,
                            "type": "medium",
                            "length": 2
                        },
                        {
                            "position": {
                                "x": 9,
                                "y": 7
                            },
                            "direction": true,
                            "type": "medium",
                            "length": 2
                        },
                        {
                            "position": {
                                "x": 5,
                                "y": 0
                            },
                            "direction": true,
                            "type": "small",
                            "length": 1
                        },
                        {
                            "position": {
                                "x": 3,
                                "y": 3
                            },
                            "direction": true,
                            "type": "small",
                            "length": 1
                        },
                        {
                            "position": {
                                "x": 8,
                                "y": 0
                            },
                            "direction": true,
                            "type": "small",
                            "length": 1
                        },
                        {
                            "position": {
                                "x": 1,
                                "y": 3
                            },
                            "direction": true,
                            "type": "small",
                            "length": 1
                        }
                    ],
                    steps: new Set(),
                }
                const new_room = { roomId: availableRooms.length + 1, roomUsers: [user, bot] }
                availableRooms.push(new_room)
                activeRooms.push(new_room as IActiveRoom)
                wss.clients.forEach((client: IExtendedWebSocket): void => {
                    updateRooms(client)
                })
                ws.send(JSON.stringify({
                    type: "create_game",
                    data: JSON.stringify({
                        idGame: new_room.roomId,
                        idPlayer: activeUser.index,
                    }),
                    id: 0,
                }))
                console.log(`Single play command received from client: Game with id: ${new_room.roomId} created`)
                break
            }
            case 'add_ships': {
                const data = JSON.parse(parsedData?.data)
                activeRooms = activeRooms.map((room: IActiveRoom): IActiveRoom => room.roomId === data.gameId ? ({
                    ...room,
                    roomUsers: room.roomUsers.map((user: IRoomUser): IRoomUser => user.index === data.indexPlayer ? ({
                        ...user,
                        ships: data.ships,
                        steps: new Set(),
                    }) : user)
                }) : room)
                const room: IActiveRoom = activeRooms.find((room: IRoom): boolean => room.roomId === data.gameId)
                const channels: IExtendedWebSocket[] = []
                console.log(`Add ships command received from client: Added ships for user ${data.indexPlayer}`)
                if (room.roomUsers.every((user: IRoomUser): number => user.ships?.length)) {
                    wss.clients.forEach((client: IExtendedWebSocket): void => {
                        if (room.roomUsers.some((user: IRoomUser): boolean => user.index === client.id)) {
                            channels.push(client)
                            const player: IRoomUser = room.roomUsers.find((user: IRoomUser): boolean => user.index === client.id)
                            const [firstUser] = room.roomUsers || []
                            client.send(JSON.stringify({
                                type: "start_game",
                                data: JSON.stringify({
                                    ships: player.ships,
                                    currentPlayerIndex: client.id,
                                }),
                                id: 0,
                            }))
                            turn(client, firstUser.index)
                            room.activePlayer = firstUser.index
                            room.roomUsers.forEach((user: IRoomUser): void => {
                                user.allShips = user.ships.map((ship: IShip): IShip => {
                                    const shipPosition: IPosition = ship.position
                                    const shipCoordinates: IPosition[] = []
                                    shipCoordinates.push(shipPosition)
                                    for (let i: number = 1; i < ship.length; i++) {
                                        const lastShipPosition: IPosition = shipCoordinates[shipCoordinates.length - 1]
                                        shipCoordinates.push(ship.direction ? { x: lastShipPosition.x, y: lastShipPosition.y + 1 } : { x: lastShipPosition.x + 1, y: lastShipPosition.y })
                                    }
                                    return {
                                        ...ship,
                                        shipCoordinates,
                                    }
                                })
                            })
                        }
                    })
                    console.log(`All ships added for room with id: ${data.gameId}, start game`)
                }
                break
            }
            case 'attack':
            case 'randomAttack':
                const response: IAttackResult | IAttackError = attack(parsedData, activeRooms, wss, winners)
                if ('error' in response) {
                    console.log(`Received ${messageType} from client: error ${response.error}`)
                } else {
                    const data = JSON.parse(parsedData?.data)
                    console.log(`Received ${messageType} from client: result ${response.position.x}, ${response.position.y} - ${response.status}`)
                    if (response.isFinished) {
                        let activeUsers = activeRooms.find((room: IActiveRoom): boolean => room.roomId === data.gameId)?.roomUsers
                        activeRooms = activeRooms.filter((room: IActiveRoom): boolean => room.roomId !== data.gameId)
                        winners = updateWinners(response.winner, winners)

                        wss.clients.forEach((client : IExtendedWebSocket): void => {
                            if (activeUsers.some((user: IRoomUser): boolean => user.index === client.id)) {
                                client.send(JSON.stringify({
                                    type: "finish",
                                    data: JSON.stringify({
                                        winPlayer: response.winner.index,
                                    }),
                                    id: 0,
                                }))
                            }
                            sendWinners(client, winners)
                        })
                    }
                }
                break
        }
    });
})


process.on('SIGINT', function(): never {
    process.exit();
})

console.log(`Start static http server on the ${HTTP_PORT} port!`);
httpServer.listen(HTTP_PORT);
