import * as vscode from 'vscode';
import { FilePool } from './utilities/FilePool';

export function activate(context: vscode.ExtensionContext) {
	const filePool = new FilePool();

	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(async (textDocument:vscode.TextDocument) => await filePool.openTextDocumentListener(textDocument)),
		vscode.workspace.onDidCloseTextDocument( (textDocument:vscode.TextDocument) => filePool.closeTextDocumentListener(textDocument)),
		vscode.workspace.onDidSaveTextDocument( (textDocument:vscode.TextDocument) => filePool.saveTextDocumentListener(textDocument)),
		vscode.commands.registerCommand('sops-edit.direct-edit', (_, files:vscode.Uri[]) => filePool.editDirectly(files))
	);
}