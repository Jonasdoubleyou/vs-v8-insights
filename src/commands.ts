import { window, Uri, workspace, commands } from "vscode";
import { analyze, FunctionInsights, FileInsights } from "./analyze";
import { openCompiledEditor, openHistoryEditor } from "./editors";
import { getScripts, instrumentCommand, cleanupInstrumentationFolder } from "./instrument";

async function askForAnalyze() {
    const pick = await window.showInformationMessage(
        "After some time the logs can be analyzed",
        "Analyze now"
    );

    if (pick) commands.executeCommand("v8-insights.analyze");
}

export async function runNPMCommand() {
    const scripts = await getScripts();

    if (!scripts.length) {
        window.showErrorMessage("Failed to find a package.json with 'node' scripts");
        return;
    }

    const commandName = await window.showQuickPick(scripts.map(it => it.name), {
        title: "Package Command to run"
    });

    const commandToRun = scripts.find(it => it.name === commandName);
    if (!commandToRun) return;


    const insightsFolder = Uri.joinPath(commandToRun.folderPath, "./.v8-insights");
    await workspace.fs.createDirectory(insightsFolder);
    console.log(`Prepared insights folder at '${insightsFolder.toString()}'`);

    const instrumentedCommand = instrumentCommand(commandToRun.command);

    const runner = window.createTerminal(`${commandToRun.name} - V8 Insights`);
    runner.show(true);
    runner.sendText(instrumentedCommand);

    await askForAnalyze();
}

export async function runFileCommand() {
    let file = window.activeTextEditor?.document.uri.toString().replace("file://", "");
    if (!file) {
        window.showErrorMessage(`Please open a JavaScript file to run this command`);
        return;
    }

    const runner = window.createTerminal(`${file.split("/").pop()} - V8 Insights`);
    runner.show(true);
    runner.sendText(instrumentCommand(`node ${file}`));

    await askForAnalyze();
}


export async function analyzeCommand() {
    const editor = window.activeTextEditor;
    if (!editor) return;

    const currentFile = editor.document.uri;
    if (!currentFile) return;

    window.showInformationMessage(`Indexing logs in .v8-insights`);

    await analyze();

    window.showInformationMessage(`Indexing done`);
}

export async function showCompiledCommand(functionInsights?: FunctionInsights) {
    if (!functionInsights) {
        window.showErrorMessage("Compiled code can only be shown for a specific function");
        return;
    }

    await openCompiledEditor(functionInsights);
}

export async function showHistoryCommand(fileInsights?: FileInsights, functionInsights?: FunctionInsights) {
    if (!fileInsights || !functionInsights) {
        window.showErrorMessage("The History can only be shown for a specific function");
        return;
    }

    await openHistoryEditor(fileInsights, functionInsights);
}

export async function cleanupCommand() {
    await cleanupInstrumentationFolder();
    window.showInformationMessage(`Successfully cleaned up the v8 insight traces`);
}