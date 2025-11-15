import { httpServer } from "./src/http_server/index";
import { WebSocketServer } from 'ws';
import { findFirstAvailable, getCoordinatesAround } from "./src/helpers";
import { IRoom, IUser, IWinner } from "./src/types";

const HTTP_PORT: number = 8181;

const wss = new WebSocketServer({ port: 3000 });
let index = 0

let availableRooms: IRoom[] = []
let winners: IWinner[] = []
let activeRooms = []


wss.on('connection', ws => {
    console.log('Websockets server started on ws://localhost:3000')
    let userData: {
        name?: string,
        id?: number,
    } = {}
    let userId: number = null
    ws.id = index
    index++

    const turn = (channel, currentPlayer) => {
        channel.send(JSON.stringify({
            type: "turn",
            data: JSON.stringify({
                currentPlayer,
            }),
            id: 0,
        }))
    }

    const attack = (parsedData) => {
        const data = JSON.parse(parsedData?.data)
        const room = activeRooms.find(room => room.roomId === data.gameId)
        if (room.activePlayer !== data.indexPlayer) return console.log('Not your turn')
        const player = room.roomUsers.find(user => user.index === data.indexPlayer)
        const enemy = room.roomUsers.find(user => user.index !== data.indexPlayer)
        let position = { x: data.x, y: data.y }

        if (parsedData?.type === 'randomAttack') {
            const available = findFirstAvailable(player.steps)
            position = { x: available.x, y: available.y }
        }
        // false -> 0 1 - horizontal
        // true -> 1    - vertical
        //         0
        const hittedShip = enemy.allShips.find(ship => ship.shipCoordinates.some(shipPosition => shipPosition.x === position.x && shipPosition.y === position.y))
        if (hittedShip) {
            hittedShip.shipCoordinates = hittedShip.shipCoordinates.filter(shipPosition => JSON.stringify(shipPosition) !== JSON.stringify(position))
        }
        let status = ''
        let turnUser = player.index

        switch (true) {
            case hittedShip?.shipCoordinates?.length === 0:
                status = 'killed'
                break;
            case hittedShip?.shipCoordinates?.length > 0:
                status = 'shot'
                break;
            default:
                status = 'miss'
                turnUser = enemy.index
                break;
        }

        wss.clients.forEach(client => {
            if (room.roomUsers.some(user => user.index === client.id)) {
                client.send(JSON.stringify({
                    type: "attack",
                    data: JSON.stringify({
                        position,
                        currentPlayer: data.indexPlayer,
                        status,
                    }),
                    id: 0,
                }))
                player.steps.add(`${position.x},${position.y}`)
                if (status === 'killed') {
                    enemy.allShips = enemy.allShips.filter(ship => JSON.stringify(ship.position) !== JSON.stringify(hittedShip.position))
                    const coordinatesAround = getCoordinatesAround(hittedShip)
                    coordinatesAround.forEach(position => {
                        client.send(JSON.stringify({
                            type: "attack",
                            data: JSON.stringify({
                                position,
                                currentPlayer: data.indexPlayer,
                                status: 'miss',
                            }),
                            id: 0,
                        }))
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
                    const winPlayer = winners.find(winner => winner.name === player.name)
                    if (winPlayer) {
                        winners = winners.map(winner => winner.name === winPlayer.name ? ({ ...winner, wins: winner.wins + 1 }) : winner)
                    } else {
                        winners.push({ name: player.name, wins: 1 })
                    }
                    client.send(JSON.stringify({
                        type: "update_winners",
                        data: JSON.stringify(winners),
                        id: 0,
                    }))
                }
                if (room.activePlayer === 'bot') {
                    setTimeout(() => {
                        attack({ type: 'randomAttack', data: JSON.stringify({ gameId: data.gameId, indexPlayer: turnUser }) })
                    }, 1000)
                }
            }
        })
    }
    ws.on('error', () => {
        ws.send(JSON.stringify({
            type: 'reg',
            data: {
                name: userData.name,
                index: ws.id,
                error: true,
                errorText: 'Connection error'
            },
            id: userId
        }));
    });
    ws.on('message', function message(data) {
        const parsedData = JSON.parse(data);
        const messageType = parsedData?.type;

        const updateRooms = (channel = ws) => {
            channel.send(JSON.stringify({
                type: "update_room",
                data: JSON.stringify(availableRooms.filter(room => room.roomUsers.length < 2)),
                id: 0,
            }))
        }

        switch (messageType) {
            case 'reg': {
                userData = JSON.parse(parsedData?.data);
                userId = parsedData?.id;
                ws.send(JSON.stringify({
                    type: "reg",
                    data: JSON.stringify({
                        name: userData.name,
                        index: ws.id,
                        error: false,
                    }),
                    id: 0,
                }));

                updateRooms()
                ws.send(JSON.stringify({
                    type: "update_winners",
                    data: JSON.stringify(winners),
                    id: 0,
                }))
                break;
            }
            case 'create_room': {
                const user = {
                    name: userData.name,
                    index: ws.id,
                }
                const new_room = { roomId: availableRooms.length + 1, roomUsers: [user] }
                availableRooms.push(new_room)
                wss.clients.forEach(client => {
                    updateRooms(client)
                })
                break
            }
            case 'add_user_to_room': {
                const data = JSON.parse(parsedData?.data)
                const indexRoom  = data?.indexRoom
                availableRooms = availableRooms?.map(room => ({
                    ...room,
                    roomUsers: indexRoom === room.roomId ? [...room.roomUsers, {
                        name: userData.name,
                        index: ws.id,
                    }] : room.roomUsers,
                }))
                const selectedRoom = availableRooms.find(room => room.roomId === indexRoom)
                wss.clients.forEach(client => {
                    updateRooms(client)
                })

                if (selectedRoom.roomUsers.length === 2) {
                    activeRooms.push(selectedRoom)
                    wss.clients.forEach(client => {
                        if (selectedRoom.roomUsers.some(user => user.index === client.id)) {
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
                const user = {
                    name: userData.name,
                    index: ws.id,
                }
                const bot = {
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
                activeRooms.push(new_room)
                wss.clients.forEach(client => {
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
                activeRooms = activeRooms.map(room => room.roomId === data.gameId ? ({
                    ...room,
                    roomUsers: room.roomUsers.map(user => user.index === data.indexPlayer ? ({
                        ...user,
                        ships: data.ships,
                        steps: new Set(),
                    }) : user)
                }) : room)
                const room = activeRooms.find(room => room.roomId === data.gameId)
                const channels = []
                if (room.roomUsers.every(user => user.ships?.length)) {
                    wss.clients.forEach(client => {
                        if (room.roomUsers.some(user => user.index === client.id)) {
                            channels.push(client)
                            const player = room.roomUsers.find(user => user.index === client.id)
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
                            room.roomUsers.forEach(user => {
                                user.allShips = user.ships.map(ship => {
                                    const shipPosition = ship.position
                                    const shipCoordinates = []
                                    shipCoordinates.push(shipPosition)
                                    for (let i = 1; i < ship.length; i++) {
                                        const lastShipPosition = shipCoordinates[shipCoordinates.length - 1]
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
                attack(parsedData)
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
