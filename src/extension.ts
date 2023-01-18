import * as vscode from 'vscode';
import * as f from './utilities/functions';

export async function activate(context: vscode.ExtensionContext) {
	// --- initialize object pools shared by listeners and commands ---
	// excluded files are TMP files created by this extension, and sops-encrypted files marked for direct editing
	var excludedFilePaths : string[] = [];

	// global list of open TMP files, containing:
	//  - temp file paths
	//  - temp file contents (to track file changes)
	//  - encryption terminals
	var tempFiles: f.ExtendedTempFile[] = [];

	// listeners
	vscode.workspace.onDidOpenTextDocument(async (textDocument:vscode.TextDocument) => await f.openTextDocumentListener(textDocument, excludedFilePaths, tempFiles));
	vscode.workspace.onDidCloseTextDocument(async (textDocument:vscode.TextDocument) => await f.closeTextDocumentListener(textDocument, excludedFilePaths, tempFiles));
	vscode.workspace.onDidSaveTextDocument(async (textDocument:vscode.TextDocument) => await f.saveTextDocumentListener(textDocument, tempFiles));

	// commands
	let disposable = vscode.commands.registerCommand('sops-edit.direct-edit', (_, files:vscode.Uri[]) => f.editDirectly(files, excludedFilePaths));
	context.subscriptions.push(disposable);
}

export function deactivate() {}