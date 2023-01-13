import * as vscode from 'vscode';
import * as f from './utilities/functions';

export function activate(context: vscode.ExtensionContext) {
	
	let disposable = vscode.commands.registerCommand('vscode-sops-edit.decrypt', (uri, files) => {
		let fpn = f.getCleanFilePathAndName(files);

		// decrypt
		let terminal: vscode.Terminal = f.cdToLocation(fpn.parentPath);
		f.executeInTerminal([`sops -i -d ${fpn.fileName}`,'exit'], terminal);

		vscode.window.onDidCloseTerminal(t => { 
			if (t === terminal && t.exitStatus) { 
				vscode.window.showInformationMessage(`Decrypted file ${fpn.fileName}`);

				// open
				let openPath = vscode.Uri.file(fpn.filePath);
				vscode.workspace.openTextDocument(openPath).then( doc => vscode.window.showTextDocument(doc));
			} 
		}); 

	});
	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
