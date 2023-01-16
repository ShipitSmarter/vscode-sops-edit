import * as vscode from 'vscode';
import * as fs from 'fs';
import * as f from './utilities/functions';
import * as c from './utilities/constants';
import { deflateSync } from 'zlib';

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
		await editDecryptedTmpCopy(encryptedFilePath,excludedFiles);
	});

	// allow direct edit by rmm button
	let disposable = vscode.commands.registerCommand('sops-edit.direct-edit', (_, files) => {
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

async function editDecryptedTmpCopy(encryptedFilePath:string, excludedFiles:string[]) : Promise<void> {
	// prep
	var enc: f.PathDetails = f.dissectPath(encryptedFilePath);
	var [parentPath, encryptedFileName] = [enc.parentPath, enc.fileName ];
	var tempFileName = `${enc.filePureName}.${c.tempFilePreExtension}.${enc.extension}`;
	var tempFilePath = `${parentPath}/${tempFileName}`;

	var decryptionString = 'Decrypting ' + encryptedFileName + ' ...';
	
	// add tmp file to excluded files
	excludedFiles.push(tempFilePath);

	// prep terminals
	const decryptTerminal = vscode.window.createTerminal({name: c.terminalDecryptName, cwd: parentPath});
	const encryptTerminal = vscode.window.createTerminal({name: c.terminalEncryptName, cwd: parentPath});

	// async decrypt with progress
	await vscode.window.withProgress(
		{location: vscode.ProgressLocation.Notification, cancellable: false, title: decryptionString}, 
		async (progress) => {
			progress.report({  increment: 0 });
			var done = [false];
			f.callInInteractiveTerminal(f.replaceInCommand(c.decryptionCommand,encryptedFileName,tempFileName), decryptTerminal).then(_ => {
				progress.report({ increment: 100 });
				done[0] = true;
				return;
			});
			await f.fakeProgressUpdate(progress,done);			
		}
	);	

	// get decrypted string in order to later be able to detect changes
	var currentDecryptedText = fs.readFileSync(tempFilePath, 'utf-8').trim();
	f.openFile(tempFilePath);

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