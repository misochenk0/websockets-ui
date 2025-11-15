import { httpServer } from "./src/http_server/index.js";
import { WebSocketServer } from 'ws';
import {IRoom, IParsedData, IRoomUser, IUser, IShip, IPosition, IExtendedWebSocket, IActiveRoom} from "./src/types.js";
import { updateWinners } from "./src/actions/update_winners.js";
import { attack } from "./src/actions/attack.js";
import { turn } from "./src/actions/turn.js";

const HTTP_PORT: number = 8181;

const wss = new WebSocketServer({ port: 3000 });
let index: number = 0

let availableRooms: IRoom[] = []
let activeRooms: IActiveRoom[] = []

wss.on('connection', (ws: IExtendedWebSocket): void => {
    console.log('Websockets server started on ws://localhost:3000')
    let userName: string = null
    let userId: number = null
    ws.id = index
    index++
    ws.on('error', (): void => {
        ws.send(JSON.stringify({
            type: 'reg',
            data: {
                name: userName,
                index: ws.id,
                error: true,
                errorText: 'Connection error'
            },
            id: userId
        }));
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
                userName = JSON.parse(parsedData?.data)?.name;
                userId = parsedData?.id;
                ws.send(JSON.stringify({
                    type: "reg",
                    data: JSON.stringify({
                        name: userName,
                        index: ws.id,
                        error: false,
                    }),
                    id: 0,
                }));

                updateRooms()
                updateWinners(null, ws)
                break;
            }
            case 'create_room': {
                const user = {
                    name: userName,
                    index: ws.id,
                }
                const new_room = { roomId: availableRooms.length + 1, roomUsers: [user] }
                availableRooms.push(new_room)
                wss.clients.forEach((client: IExtendedWebSocket): void => {
                    updateRooms(client)
                })
                break
            }
            case 'add_user_to_room': {
                const data: { indexRoom: number } = JSON.parse(parsedData?.data)
                const indexRoom: number  = data?.indexRoom
                availableRooms = availableRooms?.map((room: IRoom): IRoom => ({
                    ...room,
                    roomUsers: indexRoom === room.roomId ? [...room.roomUsers, {
                        name: userName,
                        index: ws.id,
                    }] : room.roomUsers,
                }))
                const selectedRoom: IRoom = availableRooms.find((room: IRoom): boolean => room.roomId === indexRoom)
                wss.clients.forEach((client: IExtendedWebSocket): void => {
                    updateRooms(client)
                })

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
                }
                break
            }
            case 'single_play': {
                const user: IUser = {
                    name: userName,
                    index: ws.id,
                }
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
                        idPlayer: ws.id,
                    }),
                    id: 0,
                }))
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
                if (room.roomUsers.every((user: IRoomUser): number => user.ships?.length)) {
                    wss.clients.forEach((client: IExtendedWebSocket): void => {
                        if (room.roomUsers.some((user: IRoomUser): boolean => user.index === client.id)) {
                            channels.push(client)
                            const player: IRoomUser = room.roomUsers.find((user: IRoomUser): boolean => user.index === client.id)
                            const [firstUser] = channels || []
                            client.send(JSON.stringify({
                                type: "start_game",
                                data: JSON.stringify({
                                    ships: player.ships,
                                    currentPlayerIndex: client.id,
                                }),
                                id: 0,
                            }))
                            turn(client, firstUser.id)
                            room.activePlayer = firstUser.id
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
                }
                break
            }
            case 'attack':
            case 'randomAttack':
                attack(parsedData, activeRooms, wss)
                break
        }
    });
})


process.on('SIGINT', function() {
    // wss.close();
    process.exit();
})

console.log(`Start static http server on the ${HTTP_PORT} port!`);
httpServer.listen(HTTP_PORT);
