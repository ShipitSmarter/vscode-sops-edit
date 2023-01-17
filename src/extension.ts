import * as vscode from 'vscode';
import * as fs from 'fs';
import * as f from './utilities/functions';
import * as c from './utilities/constants';

export async function activate(context: vscode.ExtensionContext) {
	// initialize list of excluded files, which are TMP files created by 
	// this extension, and sops-encrypted files marked for direct editing
	var excludedFilePaths : string[] = [];

	// keep track of opened terminals (this is necessary because of file GIT copies, 
	// to avoid opening two terminals for one file)
	var terminals: f.TerminalExtension[] = [];

	// add listener to check for each document opened if it is a sops encrypted 
	// file, and if so, close and open a decrypted copy instead
	vscode.workspace.onDidOpenTextDocument(async (openDocument:vscode.TextDocument) => {
		let encryptedFile = vscode.Uri.file(f.gitFix(openDocument.fileName));

		// only apply if this is a non-excluded sops encrypted file (and not a .git copy)
		let isNotSopsEncrypted: boolean = !(await f.fileIsSopsEncrypted(encryptedFile));
		let isExcluded: boolean = excludedFilePaths.includes(encryptedFile.path);
		if (isNotSopsEncrypted || isExcluded ) {
			return;
		}

		await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
		await editDecryptedTmpCopy(encryptedFile,excludedFilePaths, terminals);
	});

	// allow direct edit by rmm button
	let disposable = vscode.commands.registerCommand('sops-edit.direct-edit', (_, files) => {
		if (files.length === 0) {
			vscode.window.showErrorMessage('Cannot edit file directly: no file selected');
		}
		editDirectly(files[0], excludedFilePaths);
	});
	context.subscriptions.push(disposable);
}

function editDirectly(directEditFile:vscode.Uri, excludedFilePaths: string[]) : void {
		// add to excluded files
		excludedFilePaths.push(directEditFile.path);

		// add listener to remove from excluded files when closed
		vscode.workspace.onDidCloseTextDocument((e:vscode.TextDocument) => {
			let closedFile = vscode.Uri.file(f.gitFix(e.fileName));
			if (closedFile.path === directEditFile.path) {
				f.removeElementFromArray(excludedFilePaths,closedFile.path);
			}
		});

		// open
		f.openFile(directEditFile);
}

async function editDecryptedTmpCopy(encryptedFile: vscode.Uri, excludedFilePaths:string[], terminals: f.TerminalExtension[]) : Promise<void> {
	// construct temp file uri
	let enc = f.dissectUri(encryptedFile);
	let parent = enc.parent;
	var tempFileName = `${enc.filePureName}.${c.tempFilePreExtension}.${enc.extension}`;
	var tempFile : vscode.Uri = vscode.Uri.joinPath(parent,tempFileName);
	
	// add tmp file to excluded files
	excludedFilePaths.push(tempFile.path);

	// prep terminals
	const decryptTerminal = vscode.window.createTerminal({name: c.terminalDecryptName, cwd: parent.fsPath});
	const encryptTerminal = f.openExistingOrNewTerminal(tempFile,c.terminalEncryptName,terminals);

	// async decrypt with progress bar
	await vscode.window.withProgress(
		{location: vscode.ProgressLocation.Notification, cancellable: false, title: c.decryptionString.replace(c.fileString, enc.fileName)}, 
		async (progress) => {
			progress.report({  increment: 0 });
			var progressDetails = { isDone: false };
			var decryptCommand = f.replaceInCommand(c.decryptionCommand,enc.fileName,tempFileName);
			f.callInInteractiveTerminal(decryptCommand, decryptTerminal).then(_ => {
				progress.report({ increment: 100 });
				progressDetails.isDone = true;
				return;
			});
			await f.fakeProgressUpdate(progress, progressDetails);			
		}
	);	

	// get decrypted string in order to later be able to detect changes
	var currentDecryptedText = fs.readFileSync(tempFile.fsPath, 'utf-8').trim();
	f.openFile(tempFile);

	// add listener to save and encrypt when tmp file is updated
	vscode.workspace.onDidSaveTextDocument((e:vscode.TextDocument) => {
		let savedFile = vscode.Uri.file(e.fileName);
		if (savedFile.path === tempFile.path) {
			let contents = e.getText().trim();
			if (contents !== currentDecryptedText) {
				currentDecryptedText = contents;
				f.copyEncrypt(parent, enc.fileName, tempFileName, encryptTerminal);
			}
		}
	});

	// add listener to delete tmp file when closed
	vscode.workspace.onDidCloseTextDocument((e:vscode.TextDocument) => {
		let closedFile = vscode.Uri.file(f.gitFix(e.fileName));
		if (f.gitFix(closedFile.path) === tempFile.path) {
			// close terminal
			f.closeTerminalAndRemoveFromList(encryptTerminal,tempFile,terminals);

			//delete tmp file
			fs.unlinkSync(closedFile.fsPath);

			// remove from excluded files
			f.removeElementFromArray(excludedFilePaths,closedFile.path);
		}
	}); 
}

export function deactivate() {}