import * as vscode from 'vscode';
import * as fs from 'fs';
import * as f from './utilities/functions';

export function activate(context: vscode.ExtensionContext) {
	
	let disposable = vscode.commands.registerCommand('vscode-sops-edit.decrypt', (uri, files) => {
		var fpn = f.dissectPath(files);
		var [path, filepath, file, purename, ext] = [fpn.parentPath, fpn.filePath, fpn.fileName, fpn.filePureName, fpn.extension ];
		var tempfile = `${purename}.tmp.${ext}`;
		var tempfilepath = `${path}/${tempfile}`;

		// decrypt
		let terminal: vscode.Terminal = decrypt(path,file, tempfile);

		// open tmp file when terminal exits
		vscode.window.onDidCloseTerminal(t => { 
			if (t === terminal && t.exitStatus) { 
				vscode.window.showInformationMessage(`Decrypted file ${file} to ${tempfile}`);
				// open
				let openPath = vscode.Uri.file(filepath.replace(file, tempfile));
				vscode.workspace.openTextDocument(openPath).then( doc => vscode.window.showTextDocument(doc));

				// keep original decrypted string for comparison
				let original = fs.readFileSync(tempfilepath, 'utf-8').trim();

				vscode.workspace.onDidSaveTextDocument((e:vscode.TextDocument) => {
					let fdetails = f.dissectPath(e.fileName);
					if (fdetails.fileName === tempfile) {
						let contents = e.getText().trim();
						if (contents !== original) {
							copyEncrypt(path, file, tempfile);
							vscode.window.showInformationMessage(`saved to encrypted file ${file}`);
						}
					}
				});
		
				vscode.workspace.onDidCloseTextDocument((e:vscode.TextDocument) => {

					let fdetails = f.dissectPath(e.fileName.replace(/\.git$/,''));
					if (fdetails.fileName === tempfile) {
						fs.unlinkSync(fdetails.filePath);
						vscode.window.showInformationMessage(`closed and deleted file ${tempfile}`);
					}
					
				});
			}
		}); 
	
		function copyEncrypt(path:string, file:string, tempfile:string) : void {
			// save to original file
			fs.copyFileSync(`${path}/${tempfile}`,`${path}/${file}`);
			encrypt(path, file);
		}

		function encrypt(path:string, file:string): vscode.Terminal {
			let terminal: vscode.Terminal = f.cdToLocation(path);
			f.executeInTerminal([`sops -i -e ${file}`], terminal);
			return terminal;
		}

		function decrypt(path:string, file:string, tempfile:string): vscode.Terminal {
			let terminal: vscode.Terminal = f.cdToLocation(path);
			f.executeInTerminal([`sops -d ${file} > ${tempfile}`,'exit'], terminal);
			return terminal;
		}
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
