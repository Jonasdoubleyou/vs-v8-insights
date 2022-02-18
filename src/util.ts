
export async function* byLine(stream: AsyncIterable<string>): AsyncIterable<string> {
    let acc = "";
    for await(const chunk of stream) {
        const lines = (acc + chunk).split("\n");
        acc = lines.pop() ?? "";
        for(const line of lines)
            yield line;
    }
}

export function formatTime(time?: number) {
    if (time === undefined) return `?s`;
    
    const micro = time % 1000;
    let result = `${micro}μs`;

    if (time > 1000) {
        const milli = (time / 1000) % 1000; 
        result = `${milli}ms ` + result;
    }
    
    if (time > 1000 * 1000) {
        const seconds = Math.floor(time / 1000 / 1000);
        result = `${seconds}s ` + result;
    }

    return result;
}

export function findLast<T>(array: T[], predicate: (it: T) => boolean): T | null {
    for (let i = array.length - 1; i >= 0; i-= 1) {
        const value = array[i];
        if (predicate(value)) return value;
    }

    return null;
}
