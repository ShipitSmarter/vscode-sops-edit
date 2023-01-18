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

export async function openFile(file:vscode.Uri) : Promise<void> {
	// vscode.commands.executeCommand('vscode.open',file.fsPath);
	vscode.workspace.openTextDocument(file).then( doc => vscode.window.showTextDocument(doc));
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
			var decryptCommand = c.decryptionCommand.replace(c.fileString,enc.fileName).replace(c.tempFileString, temp.fileName);;
			callInInteractiveTerminal(decryptCommand, decryptTerminal).then(_ => {
				progress.report({ increment: 100 });
				progressDetails.isDone = true;
				return;
			});
			await fakeProgressUpdate(progress, progressDetails);			
		}
	);	
}

export function copyEncrypt(tempFile:vscode.Uri, terminal: vscode.Terminal) : void {
	let unTempFile = getUnTempUri(tempFile);
	fs.copyFileSync(tempFile.fsPath,unTempFile.fsPath);
	executeInTerminal([c.encryptionCommand.replace(c.fileString, getFileName(unTempFile))], terminal);
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