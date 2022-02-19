import { CancellationToken, EventEmitter, Range, TextDocument, TextDocumentContentProvider, Uri, ViewColumn, window, workspace } from "vscode";
import { CompileEndEvent, FileInsights, FunctionInsights, getInsights, getOptimizedCode } from "./analyze";
import { decompile } from "./decompile";
import { findLast } from "./util";

const reloadCompiled = new EventEmitter<Uri>();

export async function openCompiledEditor(functionInsights: FunctionInsights) {
    const lastCompiled = findLast(functionInsights.events, it => it.name === "compile-end") as CompileEndEvent;
    if (!lastCompiled) {
        window.showErrorMessage(`Failed to find last compiled code for function ${functionInsights.name}`);
        return;
    }

    const uri = Uri.parse(`v8-compiled:${lastCompiled.memory.start}.asm`);
    const document = await workspace.openTextDocument(uri); 
    const editor = await window.showTextDocument(document, ViewColumn.Beside);
    editor.setDecorations(highlightRed, findWords(document, /ret/g));
    editor.setDecorations(highlightOrange, findWords(document, /j[a-z]+/g));
    editor.setDecorations(dishighlight, findWords(document, /nop/g));
}

export function reloadCompiledEditor(editor: Uri) {
    reloadCompiled.fire(editor);
}

export const compiledEditorProvider: TextDocumentContentProvider = {
    onDidChange: reloadCompiled.event,
    async provideTextDocumentContent(uri: Uri, token: CancellationToken): Promise<string> {
        const memoryLocation = uri.path.split(".")[0];
        const optimized = (await getOptimizedCode(memoryLocation));
        const readable = decompile(optimized, uri);
        return readable;
    }

    
}

const highlightRed = window.createTextEditorDecorationType({
    color: "white",
    backgroundColor: "red",
    fontWeight: "lighter"
});


const highlightOrange = window.createTextEditorDecorationType({
    color: "orange",
    fontWeight: "bold"
});

const dishighlight = window.createTextEditorDecorationType({
    color: "grey"
});



export function findWords(document: TextDocument, regexp: RegExp): Range[] {
    const result: Range[] = [];
    const text = document.getText();

    const expr = new RegExp(regexp);
    let match: RegExpMatchArray | null;
    while((match = expr.exec(text)) !== null) {
        console.log("findText", expr.lastIndex);
        result.push(new Range(document.positionAt(expr.lastIndex - match[0].length), document.positionAt(expr.lastIndex)));
    }
    return result;
}

export async function openHistoryEditor(fileInsights: FileInsights, functionInsights: FunctionInsights) {
		const uri = Uri.parse(`v8-history:${fileInsights.filename}:${functionInsights.nameLocation.start.line}:${functionInsights.nameLocation.start.character}`);
		await workspace.openTextDocument(uri).then(doc => window.showTextDocument(doc, ViewColumn.Beside));
}

export const historyEditorProvider = {
    async provideTextDocumentContent(uri: Uri, token: CancellationToken): Promise<string> {
        const [filename, line, column] = uri.path.split(":");
        const insights = getInsights(filename);
        if (!insights) return `Unknown file ${filename}`;

        const functionInsight = insights.functions.find(it => it.nameLocation.start.line === +line);
        if (!functionInsight) return `Unknown function at ${uri.path}`;

        return JSON.stringify(functionInsight.events, null, 2);
    }
}