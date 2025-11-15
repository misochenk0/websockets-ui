import {IExtendedWebSocket, IWinner, IRoomUser} from "../types.js";


export function updateWinners(player: IRoomUser, winners: IWinner[]): IWinner[] {
    let new_winners: IWinner[] = []
    if (player?.name && player?.name !== 'bot') {
        const winPlayer: IWinner = winners.find((winner: IWinner): boolean => winner.name === player.name)
        if (winPlayer) {
            new_winners = winners.map((winner: IWinner): IWinner => winner.name === winPlayer.name ? ({ ...winner, wins: winner.wins + 1 }) : winner)
        } else {
            new_winners.push({ name: player.name, wins: 1 })
        }
    }
    return new_winners
}

export function sendWinners(client: IExtendedWebSocket, winners: IWinner[]): void {
    client.send(JSON.stringify({
        type: "update_winners",
        data: JSON.stringify(winners),
        id: 0,
    }))
}