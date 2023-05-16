import { ExtensionContext, workspace, commands, Uri, TextDocument, window, TextEditor } from 'vscode';
import { EditorContext } from './utilities/EditorContext';
import { FilePool } from './utilities/FilePool';
import { decryptCommand, encryptCommand } from './utilities/functions';

export function activate(context: ExtensionContext) {
	const filePool = new FilePool();

	context.subscriptions.push(
		workspace.onDidOpenTextDocument(async (textDocument:TextDocument) => await filePool.openTextDocumentListener(textDocument)),
		workspace.onDidCloseTextDocument( (textDocument:TextDocument) => filePool.closeTextDocumentListener(textDocument)),
		workspace.onDidSaveTextDocument( (textDocument:TextDocument) => filePool.saveTextDocumentListener(textDocument)),
		window.onDidChangeActiveTextEditor((editor:TextEditor|undefined) => EditorContext.set(editor, filePool)),
		commands.registerCommand('sops-edit.direct-edit', (_, files:Uri[]) => filePool.editDirectly(files)),
		commands.registerCommand('sops-edit.decrypt-editor', (uri:Uri) => decryptCommand(uri, filePool)),
		commands.registerCommand('sops-edit.encrypt-editor', (uri:Uri) => encryptCommand(uri, filePool))
	);
}