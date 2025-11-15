import {IExtendedWebSocket, IWinner, IRoomUser} from "../types.js";

let winners: IWinner[] = []

export function updateWinners(player: IRoomUser, client: IExtendedWebSocket): void {
    if (player?.name && player?.name !== 'bot') {
        const winPlayer: IWinner = winners.find((winner: IWinner): boolean => winner.name === player.name)
        if (winPlayer) {
            winners = winners.map((winner: IWinner): IWinner => winner.name === winPlayer.name ? ({ ...winner, wins: winner.wins + 1 }) : winner)
        } else {
            winners.push({ name: player.name, wins: 1 })
        }
    }
    client.send(JSON.stringify({
        type: "update_winners",
        data: JSON.stringify(winners),
        id: 0,
    }))
}