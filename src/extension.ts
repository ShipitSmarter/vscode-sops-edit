import * as vscode from 'vscode';
import * as fs from 'fs';
import * as f from './utilities/functions';
import * as c from './utilities/constants';

export async function activate(context: vscode.ExtensionContext) {
	// initialize list of excluded files, which are TMP files created by 
	// this extension, and sops-encrypted files marked for direct editing
	var excludedFiles : string[] = [];

	vscode.workspace.onDidOpenTextDocument(async (openDocument:vscode.TextDocument) => {
		let filePath = f.cleanPath(openDocument.fileName);

		// only apply if this is a non-excluded sops encrypted file (and not a .git copy)
		let isNotSopsEncrypted: boolean = !(await f.fileIsSopsEncrypted(filePath));
		let isExcluded: boolean = excludedFiles.includes(filePath);
		let isGitCopy = /\.git$/.test(filePath);
		if (isNotSopsEncrypted || isExcluded || isGitCopy ) {
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

		// prep terminals
		let decryptTerminal = f.createTerminalAndCdToLocation(path, c.terminalDecryptName);
		let encryptTerminal = f.createTerminalAndCdToLocation(path, c.terminalEncryptName);

		// decrypt
		f.decrypt(path,file, tempfile, decryptTerminal);

		var currentDecryptedText:string = '';

		// add listener to open tmp file when terminal exits
		vscode.window.onDidCloseTerminal(t => { 
			if (t === decryptTerminal && t.exitStatus) {
				// update decrypted string for comparison
				currentDecryptedText = fs.readFileSync(tempfilepath, 'utf-8').trim();

				// open
				f.openFile(filepath.replace(file, tempfile));
			}
		});

		// add listener to save and encrypt when tmp file is updated
		vscode.workspace.onDidSaveTextDocument((e:vscode.TextDocument) => {
			let fdetails: f.PathDetails = f.dissectPath(e.fileName);
			if (fdetails.filePath === tempfilepath) {
				let contents = e.getText().trim();
				if (contents !== currentDecryptedText) {
					currentDecryptedText = contents;
					f.copyEncrypt(path, file, tempfile, encryptTerminal);
				}
			}
		});

		// add listener to delete tmp file when closed
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
	});

	// allow direct edit by rmm button
	let disposable = vscode.commands.registerCommand('sops-edit.direct-edit', (uri, files) => {
		var fpn: f.PathDetails = f.dissectPath(files);

		// add to excluded files
		excludedFiles.push(fpn.filePath);

		// add listener to remove from excluded files when closed
		vscode.workspace.onDidCloseTextDocument((e:vscode.TextDocument) => {
			let fdetails: f.PathDetails = f.dissectPath(e.fileName);
			let isClosedDocumentThisDocument = fdetails.filePath === fpn.filePath && excludedFiles.includes(fdetails.filePath);
			if (isClosedDocumentThisDocument) {
				excludedFiles.splice(excludedFiles.indexOf(fdetails.filePath),1);
			}
		});

		// open
		f.openFile(fpn.filePath);
	});
	context.subscriptions.push(disposable);
}

export function deactivate() {}