import { Uri } from "vscode";

interface Label {
    id: number;
    // the editor line where this label appears
    line?: number;
    // the number of jumps going here
    jumpCount: number;
    // the editor lines where this label is used as a jump target
    referencedAt: number[];
    // a user set label
    label?: string;
    // the editor this label is used in
    editor: Uri;
    // naive label type deduction:
    // whether the label is reached through a backward jump
    backward: boolean;
    // whether the label is reached through a forward jump
    forward: boolean;
}

const labelForLocation = new Map<string /* memory location */, Label>();

export function getLabel(line: number) {
    for (const label of labelForLocation.values()) {
        if (label.line === line || label.referencedAt.includes(line)) {
            return label;
        }
    }

    return null;
}

export function getLabelName(label: Label) {
    if (label.label)
        return label.label;
    // user did not set a label, let's deduce something
    if (label.jumpCount === 1 && label.backward)
        return `loop${label.id}`;
    if (label.backward && !label.forward)
        return `reentry${label.id}`;
    if (label.forward && !label.backward)
        return `skip${label.id}`;
    return `label${label.id}`;
}


export function decompile(lines: string[], editor: Uri): string {
    console.log("labels", JSON.stringify(labelForLocation.entries(), null, 2));
    const result: string[] = [];
    let labelCount = 0;

    const destructLine = (line: string) => {
        const location = line.slice(0, line.indexOf(" "));
        const instructionBegin = line.indexOf(" ", 30);
        let instruction = line.slice(instructionBegin).trimStart();
        
        // Drop REX.W prefixes as they're useless according to https://stackoverflow.com/questions/36788685/meaning-of-rex-w-prefix-before-amd64-jmp-ff25
        if (instruction.startsWith("REX.W"))
           instruction = instruction.slice(6);
        
        return { location, instruction };
    };

    const { location: startLocation } = destructLine(lines[0]);
    const { location: endLocation } = destructLine(lines[lines.length - 2]);

    console.log(`Code Range ${startLocation} - ${endLocation}`);

    for(const [index, line] of lines.entries()) {
        const { location, instruction } = destructLine(line);
        
        if (instruction.startsWith("j")) {
            let [jumpType, target] = instruction.split(" ");
            // ignore jumps from registers
            if (!target.startsWith("0x")) continue; 

            if (!labelForLocation.has(target)) {
                console.log("setting label for", target);

                labelForLocation.set(target, { referencedAt: [], editor, backward: false, forward: false, id: labelCount++, jumpCount: 0 });
            }

            const label = labelForLocation.get(target)!;
            label.backward ||= target < location;
            label.forward ||= target > location;
            label.jumpCount += 1;
        }
    }

    for(const line of lines) {
        const { location, instruction } = destructLine(line);
        console.log("location", location);
        const label = labelForLocation.get(location);
        if (label) {
            // Instead of taking the position in 'lines', the position in 'result' is taken, 
            //  as injecting labels increases the number of lines
            label.line = result.length;
            console.log("got label")
            result.push(`${getLabelName(label)}:`);
        }
        
        if (instruction.startsWith("j")) {
            const [jumpType, target] = instruction.split(" ");
            // ignore jumps from registers
            if (!target.startsWith("0x")) {
                result.push(`  ${jumpType} ${target}`);
            } else if(target > endLocation || target < startLocation) {
                result.push(`  ${jumpType} ${target} (outside)`);
            } else {
                const targetLabel = labelForLocation.get(target)!;
                targetLabel.referencedAt.push(result.length);
                result.push(`  ${jumpType} ${getLabelName(targetLabel)}`);
            }

        } else {
            result.push(`  ${instruction}`);
        }
    }

    return result.join("\n");
}