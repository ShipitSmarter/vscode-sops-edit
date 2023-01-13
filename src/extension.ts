import * as vscode from 'vscode';
import * as fs from 'fs';
import * as f from './utilities/functions';

export function activate(context: vscode.ExtensionContext) {
	
	let disposable = vscode.commands.registerCommand('vscode-sops-edit.decrypt', (uri, files) => {
		let fpn = f.dissectPath(files);
		let tempFileName = `${fpn.filePureName}.tmp.${fpn.extension}`;
		// let tempFilePath = `${fpn.parentPath}/${tempFileName}`;

		// 
		let terminal: vscode.Terminal = f.cdToLocation(fpn.parentPath);
		f.executeInTerminal([`sops -d ${fpn.fileName} > ${tempFileName}`,'exit'], terminal);

		vscode.window.onDidCloseTerminal(t => { 
			if (t === terminal && t.exitStatus) { 
				vscode.window.showInformationMessage(`Decrypted file ${fpn.fileName} to ${tempFileName}`);

				// open
				let openPath = vscode.Uri.file(fpn.filePath.replace(fpn.fileName, tempFileName));
				vscode.workspace.openTextDocument(openPath).then( doc => vscode.window.showTextDocument(doc));
			} 
		}); 
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
