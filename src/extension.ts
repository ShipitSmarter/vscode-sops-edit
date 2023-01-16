import * as vscode from 'vscode';
import * as fs from 'fs';
import * as f from './utilities/functions';
import * as c from './utilities/constants';

export async function activate(context: vscode.ExtensionContext) {
	// initialize list of excluded files, which are TMP files created by 
	// this extension, and sops-encrypted files marked for direct editing
	var excludedFiles : string[] = [];

	// add listener to check for each document opened if it is a sops encrypted 
	// file, and if so, close and open a decrypted copy instead
	vscode.workspace.onDidOpenTextDocument(async (openDocument:vscode.TextDocument) => {
		let encryptedFilePath = f.cleanPath(openDocument.fileName);

		// only apply if this is a non-excluded sops encrypted file (and not a .git copy)
		let isNotSopsEncrypted: boolean = !(await f.fileIsSopsEncrypted(encryptedFilePath));
		let isExcluded: boolean = excludedFiles.includes(encryptedFilePath);
		let isGitCopy = /\.git$/.test(encryptedFilePath);
		if (isNotSopsEncrypted || isExcluded || isGitCopy ) {
			return;
		}

		await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
		editDecryptedTmpCopy(encryptedFilePath,excludedFiles);
	});

	// allow direct edit by rmm button
	let disposable = vscode.commands.registerCommand('sops-edit.direct-edit', (uri, files) => {
		if (files.length === 0) {
			vscode.window.showErrorMessage('Cannot edit file directly: no file selected');
			return;
		}
		editDirectly(files[0].fsPath, excludedFiles);
	});
	context.subscriptions.push(disposable);
}

function editDirectly(filePath:string, excludedFiles: string[]) : void {
		var directEditFile: f.PathDetails = f.dissectPath(filePath);

		// add to excluded files
		excludedFiles.push(directEditFile.filePath);

		// add listener to remove from excluded files when closed
		vscode.workspace.onDidCloseTextDocument((e:vscode.TextDocument) => {
			let closedFile: f.PathDetails = f.dissectPath(e.fileName);
			let isClosedDocumentThisDocument = closedFile.filePath === directEditFile.filePath && excludedFiles.includes(closedFile.filePath);
			if (isClosedDocumentThisDocument) {
				excludedFiles.splice(excludedFiles.indexOf(closedFile.filePath),1);
			}
		});

		// open
		f.openFile(directEditFile.filePath);
}

function editDecryptedTmpCopy(encryptedFilePath:string, excludedFiles:string[]) : void {
	// prep
	var enc: f.PathDetails = f.dissectPath(encryptedFilePath);
	var [parentPath, encryptedFileName] = [enc.parentPath, enc.fileName ];
	var tempFileName = `${enc.filePureName}.${c.tempFilePreExtension}.${enc.extension}`;
	var tempFilePath = `${parentPath}/${tempFileName}`;

	vscode.window.showInformationMessage('Decrypting ' + encryptedFileName + ' ...');
	
	// add tmp file to excluded files
	excludedFiles.push(tempFilePath);

	// prep terminals
	let decryptTerminal = f.createTerminalAndCdToLocation(parentPath, c.terminalDecryptName);
	let encryptTerminal = f.createTerminalAndCdToLocation(parentPath, c.terminalEncryptName);

	// decrypt
	f.decrypt(encryptedFileName, tempFileName, decryptTerminal);

	var currentDecryptedText:string = '';

	// add listener to open tmp file when terminal exits
	vscode.window.onDidCloseTerminal(t => { 
		if (t === decryptTerminal && t.exitStatus) {
			// update decrypted string for comparison
			currentDecryptedText = fs.readFileSync(tempFilePath, 'utf-8').trim();

			// open
			f.openFile(tempFilePath);
		}
	});

	// add listener to save and encrypt when tmp file is updated
	vscode.workspace.onDidSaveTextDocument((e:vscode.TextDocument) => {
		let savedFile: f.PathDetails = f.dissectPath(e.fileName);
		if (savedFile.filePath === tempFilePath) {
			let contents = e.getText().trim();
			if (contents !== currentDecryptedText) {
				currentDecryptedText = contents;
				f.copyEncrypt(parentPath, encryptedFileName, tempFileName, encryptTerminal);
			}
		}
	});

	// add listener to delete tmp file when closed
	vscode.workspace.onDidCloseTextDocument((e:vscode.TextDocument) => {
		let closedFile: f.PathDetails = f.dissectPath(e.fileName);
		if (closedFile.filePath === tempFilePath) {
			// close terminal, delete tmp file
			f.executeInTerminal(['exit'],encryptTerminal);
			fs.unlinkSync(closedFile.filePath);

			// remove from excluded files
			if (excludedFiles.includes(closedFile.filePath)) {
				excludedFiles.splice(excludedFiles.indexOf(closedFile.filePath),1);
			}
		}
	}); 
}

export function deactivate() {}