import { ExtensionContext, commands, workspace, languages, TextDocument } from "vscode";
import { analysisDone } from "./analyze";
import { getLenses } from "./annotate";
import { runNPMCommand, runFileCommand, analyzeCommand, cleanupCommand, showCompiledCommand, showHistoryCommand, renameLabelCommand } from "./commands";
import { compiledEditorProvider, historyEditorProvider } from "./editors";


export function activate(context: ExtensionContext) {
	const commandDisposals = [
		/* These commands can be run through CTRL+SHIFT+P or editor buttons */
		commands.registerCommand('v8-insights.run-npm', runNPMCommand),
		commands.registerCommand("v8-insights.run-file", runFileCommand),
		commands.registerCommand('v8-insights.analyze', analyzeCommand),
		commands.registerCommand('v8-insights.cleanup', cleanupCommand),

		/* These commands can be run from the code lens on functions */
		commands.registerCommand("v8-insights.show-compiled-code", showCompiledCommand),
		commands.registerCommand("v8-insights.compilation-history", showHistoryCommand),

		/* These commands can be run from the compiled editor menu */
		commands.registerCommand("v8-insights.set-label", renameLabelCommand)
	];


	workspace.registerTextDocumentContentProvider("v8-compiled", compiledEditorProvider);
	workspace.registerTextDocumentContentProvider("v8-history", historyEditorProvider);

	/* The main functionality: A Code lens which shows compilation information inside JS code */
	languages.registerCodeLensProvider("javascript", {
		onDidChangeCodeLenses: analysisDone.event,
		provideCodeLenses(document: TextDocument) {
			return getLenses(document);
		}
	});

	context.subscriptions.push(...commandDisposals);
}

export function deactivate() {}
