import * as vscode from 'vscode';
import { FilePool } from './utilities/FilePool';
import { decryptCommand, encryptCommand } from './utilities/functions';

export function activate(context: vscode.ExtensionContext) {
	const filePool = new FilePool();

	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(async (textDocument:vscode.TextDocument) => await filePool.openTextDocumentListener(textDocument)),
		vscode.workspace.onDidCloseTextDocument( (textDocument:vscode.TextDocument) => filePool.closeTextDocumentListener(textDocument)),
		vscode.workspace.onDidSaveTextDocument( (textDocument:vscode.TextDocument) => filePool.saveTextDocumentListener(textDocument)),
		vscode.commands.registerCommand('sops-edit.direct-edit', (_, files:vscode.Uri[]) => filePool.editDirectly(files)),
		vscode.commands.registerCommand('sops-edit.decrypt-context', (_, files:vscode.Uri[]) => decryptCommand(files)),
		vscode.commands.registerCommand('sops-edit.decrypt-editor', (uri:vscode.Uri, ) => decryptCommand(uri)),
		vscode.commands.registerCommand('sops-edit.encrypt-context', (_, files:vscode.Uri[]) => encryptCommand(files)),
		vscode.commands.registerCommand('sops-edit.encrypt-editor', (uri:vscode.Uri, ) => encryptCommand(uri))
	);
}