import { CancellationToken, Uri, ViewColumn, window, workspace } from "vscode";
import { CompileEndEvent, FileInsights, FunctionInsights, getInsights, getOptimizedCode } from "./analyze";
import { findLast } from "./util";

export async function openCompiledEditor(functionInsights: FunctionInsights) {
    const lastCompiled = findLast(functionInsights.events, it => it.name === "compile-end") as CompileEndEvent;
    if (!lastCompiled) {
        window.showErrorMessage(`Failed to find last compiled code for function ${functionInsights.name}`);
        return;
    }

    const uri = Uri.parse(`v8-compiled:${lastCompiled.memory.start}`);
    await workspace.openTextDocument(uri).then(doc => window.showTextDocument(doc, ViewColumn.Beside));
}

export const compiledEditorProvider = {
    async provideTextDocumentContent(uri: Uri, token: CancellationToken): Promise<string> {
        const memoryLocation = uri.path;
        return (await getOptimizedCode(memoryLocation)).join('\n');
    }
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