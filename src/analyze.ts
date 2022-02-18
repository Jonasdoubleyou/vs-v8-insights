import { EventEmitter, Location, Position, Range, Uri, window, workspace } from "vscode";
import * as fs from "fs";
import { byLine, findLast } from "./util";

export interface FileInsights {
    filename: string;
    functions: FunctionInsights[];
}

export interface FunctionInsights {
    name: string;
    nameLocation: Range;
    events: FunctionEvent[];
    isCompiled: boolean;
    wasDeoptimized: boolean;
    compileTime?: number;
}

interface MemoryArea { start: string /* as 0x... */, size: number }

export interface ParseEvent {
    name: "parse";
    memory: MemoryArea;
}

export interface CompileStartEvent {
    name: "compile-start";
}

export interface CompileEndEvent {
    name: "compile-end";
    memory: MemoryArea;
}

export interface DeoptimizeEvent {
    name: "deoptimize";
    reason: string;
    from: string;
}

type FunctionEvent = ({ at: number }) & (ParseEvent | CompileStartEvent | CompileEndEvent | DeoptimizeEvent);

function getInsightsFolder() {
    const currentFile = window.activeTextEditor?.document.uri;
    if (!currentFile) {
        throw new Error(`Open a file`);
    }

    const currentWorkspace = workspace.getWorkspaceFolder(currentFile);
    if (!currentWorkspace) throw new Error(`No workspace found for file '${currentFile.toString()}`);
    
	return Uri.joinPath(currentWorkspace!.uri, "./.v8-insights");
}

function readTrace(name: string) {
    const filePath = Uri.joinPath(getInsightsFolder(), name).toString().replace("file://", "");
    return fs.createReadStream(filePath);
}

function parseFullLocation(path: string, unnamed: boolean) {
    let name: string = "unknown", fullLocation: string;

    if (unnamed) {
        fullLocation = path.slice(1, -1);
    } else {
        ([name, fullLocation] = path.split(" "));
    }

    const [filename, line, column] = fullLocation.replace("file://", "").split(":");
    return { name, filename, line: +line - 1, column: +column, fullLocation };
}


const insights: Map<string, FileInsights> = new Map();

export const analysisDone = new EventEmitter<void>();

export async function analyze(): Promise<void> {
    insights.clear();

    const functionsByLocation = new Map<string, FunctionInsights>();
    const functionsByCompiledLocation = new Map<string, FunctionInsights>();

    function createFunctionInsights(source: string, unnamedSource: boolean): FunctionInsights {
        const { name, filename, line, column, fullLocation } = parseFullLocation(source, unnamedSource);

        let functionInsight = functionsByLocation.get(fullLocation);

        if (!functionInsight) {
            functionInsight = {
                name,
                events: [],
                nameLocation: new Range(
                    new Position(line, column), 
                    new Position(line, column + name.length)
                ),
                isCompiled: false,
                wasDeoptimized: false
            }


            let fileInsights = insights.get(filename);
            if (!fileInsights) {
                fileInsights = { filename, functions: [] };
                insights.set(filename, fileInsights);
                console.log(`Registered insights for file '${filename}'`);
            }

            fileInsights.functions.push(functionInsight);
            functionsByLocation.set(fullLocation, functionInsight);
            console.log(`Registered insights for function '${filename}' -> '${name}'`);
        }

        return functionInsight;
    }

    for await(const logLine of byLine(readTrace("./log"))) {
        if (logLine.startsWith("code-creation,Script,11")) {
            // code-creation,Script,11,129974,0x250f4074d83e,81, file:///home/jonas/projects/vs-v8-insights/examples/deoptimize.js:1:1,0x250f4074d5f0,~
            const [,,,timestamp,memoryStart,memorySize,source] = logLine.split(",");
            const insights = createFunctionInsights(source, false);

            insights.events.push({
                name: "parse",
                at: +timestamp,
                memory: { start: memoryStart, size: +memorySize }
            });
        } else if(logLine.startsWith("code-creation,LazyCompile,11")) {
            // code-creation,LazyCompile,11,130193,0x250f4074dcb6,16,f file:///home/jonas/projects/vs-v8-insights/examples/deoptimize.js:10:11,0x250f4074d740,~
            const [,,,timestamp,memoryStart,memorySize,source] = logLine.split(",");
            const insights = createFunctionInsights(source, false);

            insights.events.push({
                name: "compile-start",
                at: +timestamp
            });
        } else if (logLine.startsWith("code-creation,LazyCompile,0")) {
            // code-creation,LazyCompile,0,131818,0xadc3bf43380,161,f file:///home/jonas/projects/vs-v8-insights/examples/deoptimize.js:10:11,0x250f4074d740,*
            const [,,,timestamp,memoryStart,memorySize,source] = logLine.split(",");
            const insights = createFunctionInsights(source, false);


            const compileStart = findLast(insights.events, it => it.name === "compile-start");
            if (compileStart) {
                insights.compileTime = +timestamp - compileStart.at;
            }

            insights.isCompiled = true;

            insights.events.push({
                name: "compile-end",
                at: +timestamp,
                memory: { start: memoryStart, size: +memorySize }
            });

            functionsByCompiledLocation.set(memoryStart, insights);
        } else if(logLine.startsWith("code-deopt")) {
            // code-deopt,131848,288,0xadc3bf43380,-1,165,soft,<file:///home/jonas/projects/vs-v8-insights/examples/deoptimize.js:11:3>,Insufficient type feedback for call
            
            const [, timestamp, size, code, inliningId, scriptOffset, bailoutType, source, reason] = logLine.split(",");
            const insights = functionsByCompiledLocation.get(code);
            if (!insights) continue;

            insights.isCompiled = false;
            insights.wasDeoptimized = true;

            insights.events.push({
                name: "deoptimize",
                at: +timestamp,
                reason,
                from: source.slice(1, -1)
            });
        }
    }

    analysisDone.fire();
}

export function getInsights(file: string) {
    console.log(`Getting insights for file '${file}'`);
    return insights.get(file);
}

export async function getOptimizedCode(memoryLocation: string) {
    const result: string[] = [];

    console.log(`Reading optimized code from ${memoryLocation}`);

    let scan = false;
    for await(const optLine of byLine(readTrace("./opt-code"))) {
        if (!scan) {
            if (!optLine.startsWith(memoryLocation)) continue;
            scan = true;
            continue;
        }
        if (scan) {
            if (optLine === "") scan = false;
            
        }

        result.push(optLine)
    }
    
    return result;
  }