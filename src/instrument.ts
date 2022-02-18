import { Uri, workspace } from "vscode";

/* By passing some flags into NodeJS (which passes them on to V8), V8 logs everything we need to analyze what's going on 
   intg the .v8-insights folder */
const INSTRUMENTATION_ARGS = [
    // "--trace-ignition-codegen", - in the future we might want to inspect IR, however this is logged to sterr ...
    "--no-logfile-per-isolate",
    "--allow-natives-syntax", // optional, though usually useful when inspecting V8
    "--trace-ic", // traces inline caching
    
    "--print-opt-code", 
    "--redirect-code-traces", // opt-code is logged to a separate file 
    "--redirect-code-traces-to=.v8-insights/opt-code",

    "--logfile=.v8-insights/log"
];

interface ScriptInfo {
    name: string;
    packagePath: Uri;
    folderPath: Uri;
    command: string;
}

export async function cleanupInstrumentationFolder() {
    for (const folder of workspace.workspaceFolders ?? []) {
        try {
            const insightsFolder = Uri.joinPath(folder.uri, "./.v8-insights");
            await workspace.fs.delete(insightsFolder, { recursive: true });
    
        } catch(error) {}
    }
}

/* Returns all 'node ...' commands in all package.jsons in all workspaces root folders */
export async function getScripts(): Promise<ScriptInfo[]> {
    const scripts: ScriptInfo[] = [];

    for (const folder of workspace.workspaceFolders ?? []) {
        try {
            const packagePath = Uri.joinPath(folder.uri, "./package.json")
            const packageDeclaration = JSON.parse((await workspace.fs.readFile(packagePath)).toString());
            for(const [name, command] of Object.entries(packageDeclaration.scripts as Record<string, string>)) {
                if (!command.startsWith("node")) continue;
                scripts.push({
                    name,
                    packagePath,
                    folderPath: folder.uri,
                    command
                });
            }

        } catch(error) {
            console.log(`Failed to inspect package.json of Workspace(${folder.name}), skipping`, error);
        }
    }

    return scripts;
}

/* Takes a NodeJS command like 'node --some-arg file.js' and adds all necessary flags for V8 insights */
export function instrumentCommand(command: string) {
    const commandArgs = command.split(" ");
    commandArgs.shift(); // "node"
    const commandFile = commandArgs.pop();

    commandArgs.push(...INSTRUMENTATION_ARGS);

    const enrichedCommand = `node ${commandArgs.join(" ")} ${commandFile}`;
    console.log(`Command '${command}' enriched as '${enrichedCommand}'`);
    
    return enrichedCommand;
}