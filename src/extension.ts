import * as vscode from 'vscode';
import * as f from './utilities/functions';

export function activate(context: vscode.ExtensionContext) {
	
	let disposable = vscode.commands.registerCommand('vscode-sops-edit.decrypt', (uri, files) => {
		let fpn = f.getCleanFilePathAndName(files);
		let terminal: vscode.Terminal = f.cdToLocation(fpn.parentPath);
		f.executeInTerminal([`sops -i -d ${fpn.fileName}`], terminal);
		vscode.window.showInformationMessage('Your decryption code here');
	});
	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
