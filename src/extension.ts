import * as vscode from 'vscode';
import * as fs from 'fs';
import * as f from './utilities/functions';
import * as c from './utilities/constants';

export async function activate(context: vscode.ExtensionContext) {
	// --- initialize object pools shared by listeners ---
	// excluded files are TMP files created by this extension, and sops-encrypted files marked for direct editing
	var excludedFilePaths : string[] = [];

	// global list of open TMP files, containing:
	//  - temp file paths
	//  - temp file contents (to track file changes)
	//  - encryption terminals (necessary because of file GIT copies, to avoid opening two terminals for one file)
	var tempFiles: f.TempFileExtension[] = [];

	/// --- add listeners ---
	// on open document: if it is a sops encrypted file: close and open a decrypted copy instead
	vscode.workspace.onDidOpenTextDocument(async (openDocument:vscode.TextDocument) => {
		let encryptedFile = vscode.Uri.file(f.gitFix(openDocument.fileName));

		// only apply if this is a non-excluded sops encrypted file (and not a .git copy)
		let isNotSopsEncrypted: boolean = !(await f.isSopsEncrypted(encryptedFile));
		let isExcluded: boolean = excludedFilePaths.includes(encryptedFile.path);
		if (isNotSopsEncrypted || isExcluded ) {
			return;
		}

		await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
		await editDecryptedTmpCopy(encryptedFile,excludedFilePaths, tempFiles);
	});

	// on close document: 
	// 	- remove document from excluded files (if present)
	// 	- if it is a tmp version of SOPS encrypted file: delete
	vscode.workspace.onDidCloseTextDocument(async (e:vscode.TextDocument) => {
		let closedFile = vscode.Uri.file(f.gitFix(e.fileName));
		f.removeElementFromArrayIfPresent(excludedFilePaths,closedFile.path);
		
		// remove tempFiles entry, close terminal, delete tempFile
		f.removeTempFilesEntryAndDelete(tempFiles, closedFile);
	});

	// on save document: save and encrypt when it is a tmp file
	vscode.workspace.onDidSaveTextDocument(async (e:vscode.TextDocument) => {
		let savedFile = vscode.Uri.file(f.gitFix(e.fileName));
		let content = e.getText().trim();
		f.copyEncryptSaveContentsIfTempFile(tempFiles, savedFile, content);
	});

	// --- actions ---
	// allow direct edit by rmm button
	let disposable = vscode.commands.registerCommand('sops-edit.direct-edit', (_, files) => {
		if (files.length === 0) {
			vscode.window.showErrorMessage('Cannot edit file directly: no file selected');
		}
		editDirectly(files[0], excludedFilePaths);
	});
	context.subscriptions.push(disposable);
}

// --- functions ---
function editDirectly(directEditFile:vscode.Uri, excludedFilePaths: string[]) : void {
		// add to excluded files and open
		excludedFilePaths.push(directEditFile.path);
		f.openFile(directEditFile);
}

async function editDecryptedTmpCopy(encryptedFile: vscode.Uri, excludedFilePaths:string[], tempFiles: f.TempFileExtension[]) : Promise<void> {
	// prep
	let tempFile = f.getTempUri(encryptedFile);

	// decrypt
	await f.decryptWithProgressBar(encryptedFile, tempFile);
	
	// add to excluded files
	excludedFilePaths.push(tempFile.path);

	// add to tempFiles (and create encryption terminal)
	f.addTempFilesEntry(tempFiles,tempFile);

	// open file
	await f.openFile(tempFile);
}

export function deactivate() {}