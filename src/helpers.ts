import { IPosition } from "./types.js";

export function getCoordinatesAround({ position, direction, length }: { position: IPosition, direction: boolean, length: number }): IPosition[] {
    const { x, y } = position || {};
    const GRID_SIZE = 10;
    const main: IPosition[] = [];

    for (let i = 0; i < length; i++) {
        main.push({
            x: direction ? x : x + i,
            y: direction ? y + i : y,
        });
    }

    const around = new Set();

    for (const { x: cx, y: cy } of main) {
        for (let dx: number = -1; dx <= 1; dx++) {
            for (let dy: number = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;

                const nx: number = cx + dx;
                const ny: number = cy + dy;

                if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;

                around.add(`${nx},${ny}`);
            }
        }
    }

    for (const { x: mx, y: my } of main) {
        around.delete(`${mx},${my}`);
    }

    return Array.from(around).map((str: string): IPosition => {
        const [ax, ay] = str.split(',').map(Number);
        return { x: ax, y: ay };
    });
}

export function findFirstAvailable(used: Set<string>): IPosition | null {
    for (let y: number = 0; y < 10; y++) {
        for (let x: number = 0; x < 10; x++) {
            const key = `${x},${y}`;
            if (!used.has(key)) {
                return {x, y};
            }
        }
    }
    return null;
}
