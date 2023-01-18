import * as fs from "fs";
import * as yaml from "yaml";
import * as vscode from "vscode";
import * as c from "./constants";

export type PatternSet = [string, string[]];
export type PathDetails = {
	fileName:string, 
	parent:vscode.Uri, 
	filePureName:string, 
	extension:string
};

export type ExtendedTempFile = {
	filePath: string,
	terminal: vscode.Terminal,
	content: string
};

export function executeInTerminal(commandArray:string[], terminal:vscode.Terminal = vscode.window.createTerminal()) : vscode.Terminal {
	for (const psCommand of commandArray) {
		terminal.sendText(psCommand);
	}
	return terminal;
}

export function getParentUri(file:vscode.Uri) : vscode.Uri {
	return vscode.Uri.joinPath(file,'..');
}

export function dissectUri(file:vscode.Uri) : PathDetails {
	let fName = file.path.split('/').pop() ?? '';

	return {
		fileName: fName,
		parent: getParentUri(file,),
		filePureName: fName.replace(c.getFileExtensionRegExp,''),
		extension: fName.split('.').pop() ?? ''
	};
}

export function getTempFileName(file:vscode.Uri) : string {
	let fd = dissectUri(file);
	return `${fd.filePureName}.${c.tempFilePreExtension}.${fd.extension}`;
}

export function getUnTempFileName(tempFile:vscode.Uri): string {
	let tfd = dissectUri(tempFile);
	return `${tfd.filePureName.replace(c.tempPreExtensionRegExp,'')}.${tfd.extension}`;
}

export function getTempUri(file:vscode.Uri) : vscode.Uri {
	let fd = dissectUri(file);
	return vscode.Uri.joinPath(fd.parent,getTempFileName(file));
}

export function getUnTempUri(tempFile:vscode.Uri) : vscode.Uri {
	let tfd = dissectUri(tempFile);
	return vscode.Uri.joinPath(tfd.parent, getUnTempFileName(tempFile));
}

export function getFileName(file:vscode.Uri): string {
	return dissectUri(file).fileName;
}

export function copyEncrypt(tempFile:vscode.Uri, terminal: vscode.Terminal) : void {
	let unTempFile = getUnTempUri(tempFile);
	fs.copyFileSync(tempFile.fsPath,unTempFile.fsPath);
	encrypt(getFileName(unTempFile), terminal);
}

export function encrypt(fileName:string, terminal:vscode.Terminal): void {
	executeInTerminal([c.encryptionCommand.replace(c.fileString,fileName)], terminal);
}

export async function decryptWithProgressBar(encryptedFile:vscode.Uri,tempFile:vscode.Uri): Promise<void> {
	let parent = getParentUri(encryptedFile);
	let enc = dissectUri(encryptedFile);
	var temp = dissectUri(tempFile);

	// async decrypt with progress bar
	const decryptTerminal = vscode.window.createTerminal({name: c.terminalDecryptName, cwd: parent.fsPath});
	await vscode.window.withProgress(
		{location: vscode.ProgressLocation.Notification, cancellable: false, title: c.decryptionString.replace(c.fileString, enc.fileName)}, 
		async (progress) => {
			progress.report({  increment: 0 });
			var progressDetails = { isDone: false };
			var decryptCommand = c.decryptionCommand.replace(c.fileString,enc.fileName).replace(c.tempFileString,temp.fileName);;
			callInInteractiveTerminal(decryptCommand, decryptTerminal).then(_ => {
				progress.report({ increment: 100 });
				progressDetails.isDone = true;
				return;
			});
			await fakeProgressUpdate(progress, progressDetails);			
		}
	);	
}

export async function isSopsEncrypted(file:vscode.Uri) : Promise<boolean> {
	// go through all regexes in all .sops.yaml files, combine them with 
	// the .sops.yaml file location, and return if given file path matches any
	var sopsFiles =  await vscode.workspace.findFiles(c.sopsYamlGlob);
	for (const sf of sopsFiles) {
		var pr: PatternSet = getSopsPatternsFromFile(sf);
		for (const re of pr[1]) {
			if (new RegExp(`${pr[0]}/.*${re}`).test(file.path)) {
				return true;
			}
		}
	}
	return false;
}

export function getSopsPatternsFromFile(sopsFile:vscode.Uri) : PatternSet {
	// open .sops.yaml file, extract path_regex patterns,
	// combine with file location to return a PatternSet
	let contentString: string = fs.readFileSync(sopsFile.fsPath,'utf-8');
	let content = yaml.parse(contentString);
	let fileRegexes: string[] = content.creation_rules.map((cr:any) => cr.path_regex);
	return [getParentUri(sopsFile).path, fileRegexes];
}

export async function openFile(file:vscode.Uri) : Promise<void> {
	// vscode.commands.executeCommand('vscode.open',file.fsPath);
	vscode.workspace.openTextDocument(file).then( doc => vscode.window.showTextDocument(doc));
}

export function addTempFilesEntry(tempFiles: ExtendedTempFile[], tempFile: vscode.Uri) : void {
	let index = getTempFileIndex(tempFiles,tempFile);
	if (index === -1) {
		let terminal = vscode.window.createTerminal({name: c.terminalEncryptName, cwd: getParentUri(tempFile).fsPath});
		tempFiles.push({
			terminal:terminal, 
			filePath:tempFile.path, 
			content: ''
		});
	}
}

export function removeTempFilesEntryAndDelete(tempFiles:ExtendedTempFile[], tempFile:vscode.Uri) : void {
	let index = getTempFileIndex(tempFiles,tempFile);
	if (index !== -1) {
		let terminal = tempFiles[index].terminal;
		executeInTerminal(['exit'],terminal);
		tempFiles.splice(index,1);
		fs.unlinkSync(tempFile.fsPath);
	}
}

export function copyEncryptSaveContentsIfTempFile(tempFiles:ExtendedTempFile[], tempFile:vscode.Uri, tempFileContent: string) : void {
	let index = getTempFileIndex(tempFiles,tempFile);
	if (index !== -1 && tempFiles[index].content !== tempFileContent) {
		tempFiles[index].content = tempFileContent;
		copyEncrypt(tempFile,tempFiles[index].terminal);
	}
}

export function getTempFileIndex(tempFiles:ExtendedTempFile[],tempFile:vscode.Uri) : number {
	return tempFiles.findIndex(t => t.filePath === tempFile.path);
}

export async function callInInteractiveTerminal(command: string, terminal: vscode.Terminal): Promise<vscode.TerminalExitStatus> {
	// wrapper function for terminal call to make it async and 
	// return promise once terminal is closed
	// from https://stackoverflow.com/a/72887036/1716283
	terminal.sendText(command, false);
	terminal.sendText("; exit");
	return new Promise((resolve, reject) => {
		const disposeToken = vscode.window.onDidCloseTerminal(
			async (closedTerminal) => {
			if (closedTerminal === terminal) {
				disposeToken.dispose();
				if (terminal.exitStatus !== undefined) {
					resolve(terminal.exitStatus);
				} else {
					reject("Terminal exited with undefined status");
				}
			}
			}
		);
	});
}

export function gitFix(path:string) : string {
	return path.replace(c.gitExtensionRegExp,'');
}

export function removeElementFromArrayIfPresent(array:any[], element:any) : void {
	if (array.includes(element)) {
		array.splice(array.indexOf(element),1);
	}
}

export async function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

export async function fakeProgressUpdate(progressParameter:any, progress: { isDone:boolean }) : Promise<void> {
	var rem = 100;
	while(!progress.isDone) {
		await delay(1000);
		let inc = Math.floor(rem/2.5);
		rem -= inc;
		if (inc > 1) {
			progressParameter.report({ increment: inc});
		}
	}
	return;
}

export function editDirectly(files:vscode.Uri[], excludedFilePaths: string[]) : void {
	// show error message if no files selected
	if (files.length === 0) {
		vscode.window.showErrorMessage('Cannot edit file directly: no file selected');
	} else {
		// add to excluded files and open
		let directEditFile = files[0];
		excludedFilePaths.push(directEditFile.path);
		openFile(directEditFile);
	}
}

export async function editDecryptedTmpCopy(encryptedFile: vscode.Uri, excludedFilePaths:string[], tempFiles: ExtendedTempFile[]) : Promise<void> {
	// prep
	let tempFile = getTempUri(encryptedFile);

	let index = getTempFileIndex(tempFiles,tempFile);
	if (index === -1) {
		// add to tempFiles
		addTempFilesEntry(tempFiles,tempFile);

		// add to excluded files
		excludedFilePaths.push(tempFile.path);

		// decrypt
		await decryptWithProgressBar(encryptedFile, tempFile);

		// update tempFiles entry with file content
		tempFiles[getTempFileIndex(tempFiles, tempFile)].content = fs.readFileSync(tempFile.fsPath,'utf-8');

		// open TMP file
		await openFile(tempFile);
	}	
}

export async function openTextDocumentListener(textDocument:vscode.TextDocument, excludedFilePaths: string[], tempFiles: ExtendedTempFile[]) : Promise<void> {
	// on open document: if it is a sops encrypted file: close and open a decrypted copy instead
	let encryptedFile = vscode.Uri.file(gitFix(textDocument.fileName));

	// only apply if this is a non-excluded sops encrypted file (and not a .git copy)
	let isNotSopsEncrypted: boolean = !(await isSopsEncrypted(encryptedFile));
	let isExcluded: boolean = excludedFilePaths.includes(encryptedFile.path);
	if (isNotSopsEncrypted || isExcluded ) {
		return;
	}

	await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
	await editDecryptedTmpCopy(encryptedFile,excludedFilePaths, tempFiles);
}

export async function closeTextDocumentListener(textDocument:vscode.TextDocument, excludedFilePaths: string[], tempFiles: ExtendedTempFile[]) : Promise<void> {
	// on close document: 
	// 	- remove document from excluded files (if present)
	// 	- if it is a tmp version of SOPS encrypted file: remove entry, close terminal, delete
	let closedFile = vscode.Uri.file(gitFix(textDocument.fileName));
	removeElementFromArrayIfPresent(excludedFilePaths,closedFile.path);
	removeTempFilesEntryAndDelete(tempFiles, closedFile);
}

export async function saveTextDocumentListener(textDocument:vscode.TextDocument, tempFiles: ExtendedTempFile[]) : Promise<void> {
	// on save document: save and encrypt when it is a tmp file
	let savedFile = vscode.Uri.file(gitFix(textDocument.fileName));
	let content = textDocument.getText().trim();
	copyEncryptSaveContentsIfTempFile(tempFiles, savedFile, content);
}