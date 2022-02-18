import { window, OverviewRulerLane, TextDocument, CodeLens } from "vscode";
import { FileInsights, getInsights } from "./analyze";
import { formatTime } from "./util";


export function getLenses(document: TextDocument): CodeLens[] {
    const lenses: CodeLens[] = [];
    const insights = getInsights(document.uri.toString().replace("file://", ""));
    if (!insights) return [];

    for (const functionInsight of insights.functions) {
        let summary = `${functionInsight.isCompiled ? `compiled in ${formatTime(functionInsight.compileTime)}` : `interpreted`}`;

        if (functionInsight.wasDeoptimized) 
            summary += ` - was deoptimized`;

        lenses.push({
            range: functionInsight.nameLocation,
            isResolved: false,
            
            command: {
                command: "v8-insights.compilation-history",
                title: summary,
                arguments: [insights, functionInsight]
            }
        });

        if (functionInsight.isCompiled) lenses.push({
            range: functionInsight.nameLocation,
            isResolved: false,
            
            command: {
                command: "v8-insights.show-compiled-code",
                title: "compiled code",
                arguments: [functionInsight]
            }
        });
    }
    return lenses;
}