import * as vscode from 'vscode';
import * as fs from 'fs';
import * as yaml from 'yaml';
import * as f from './utilities/functions';
import * as c from './utilities/constants';

export async function activate(context: vscode.ExtensionContext) {
	// initialize list of excluded files, which are TMP files created by 
	// this extension, and sops-encrypted files marked for direct editing
	var excludedFiles : string[] = [];

	vscode.workspace.onDidOpenTextDocument(async (openDocument:vscode.TextDocument) => {
		// only apply if this is a non-excluded sops encrypted file
		let filePath = f.cleanPath(openDocument.fileName);
		let isNotSopsEncr: boolean = !(await f.fileIsSopsEncrypted(filePath));
		let isExcluded: boolean = excludedFiles.includes(filePath);
		if (isNotSopsEncr || isExcluded ) {
			return;
		}

		// close the just-opened original document
		vscode.commands.executeCommand("workbench.action.closeActiveEditor");

		// prep
		var fpn: f.PathDetails = f.dissectPath(openDocument.fileName);
		var [path, filepath, file, purename, ext] = [fpn.parentPath, fpn.filePath, fpn.fileName, fpn.filePureName, fpn.extension ];
		var tempfile = `${purename}.${c.tempFilePreExtension}.${ext}`;
		var tempfilepath = `${path}/${tempfile}`;
		
		// add tmp file to excluded files
		excludedFiles.push(tempfilepath);

		// open terminals
		let decryptTerminal: vscode.Terminal = f.decrypt(path,file, tempfile);
		let encryptTerminal: vscode.Terminal = f.cdToLocation(path,vscode.window.createTerminal(c.terminalEncryptName));
		var original:string = '';

		// save and encrypt when tmp file is updated
		vscode.workspace.onDidSaveTextDocument((e:vscode.TextDocument) => {
			let fdetails: f.PathDetails = f.dissectPath(e.fileName);
			if (fdetails.filePath === tempfilepath) {
				let contents = e.getText().trim();
				if (contents !== original) {
					original = contents;
					f.copyEncrypt(path, file, tempfile, encryptTerminal);
				}
			}
		});

		// delete tmp file when closed
		vscode.workspace.onDidCloseTextDocument((e:vscode.TextDocument) => {
			let fdetails: f.PathDetails = f.dissectPath(e.fileName);
			if (fdetails.filePath === tempfilepath) {
				// close terminal, delete tmp file
				f.executeInTerminal(['exit'],encryptTerminal);
				fs.unlinkSync(fdetails.filePath);

				// remove from excluded files
				if (excludedFiles.includes(fdetails.filePath)) {
					excludedFiles.splice(excludedFiles.indexOf(fdetails.filePath),1);
				}
			}
		});

		// open tmp file when terminal exits
		vscode.window.onDidCloseTerminal(t => { 
			if (t === decryptTerminal && t.exitStatus) {
				// keep original decrypted string for comparison
				original = fs.readFileSync(tempfilepath, 'utf-8').trim();

				// open
				f.openFile(filepath.replace(file, tempfile));
			}
		}); 
	});

	// allow direct edit by rmm button
	let disposable = vscode.commands.registerCommand('sops-edit.direct-edit', (uri, files) => {
		var fpn: f.PathDetails = f.dissectPath(files);

		// add to excluded files
		excludedFiles.push(fpn.filePath);

		// remove from excluded files when closed
		vscode.workspace.onDidCloseTextDocument((e:vscode.TextDocument) => {
			let fdetails: f.PathDetails = f.dissectPath(e.fileName);
			if (fdetails.filePath === fpn.filePath && excludedFiles.includes(fdetails.filePath)) {
				excludedFiles.splice(excludedFiles.indexOf(fdetails.filePath),1);
			}
		});

		// open
		f.openFile(fpn.filePath);
	});
	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}