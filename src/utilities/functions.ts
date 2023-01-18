import * as fs from "fs";
import * as yaml from "yaml";
import * as vscode from "vscode";
import * as c from "./constants";

type PatternSet = [string, string[]];
type PathDetails = {
	fileName:string, 
	parent:vscode.Uri, 
	filePureName:string, 
	extension:string
};
type Progress = vscode.Progress<{
    message?: string | undefined;
    increment?: number | undefined;
}>;

type ExtendedTempFile = {
	tempFile: vscode.Uri,
    originalFile: vscode.Uri,
	content: string
};

export async function closeTextDocument() : Promise<void> {
	// original closeTextDocument is deprecated.
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
}

export function executeInTerminal(commandArray:string[], terminal:vscode.Terminal)  {
	for (const psCommand of commandArray) {
		terminal.sendText(psCommand);
	}
}

export function getParentUri(file:vscode.Uri) : vscode.Uri {
	return vscode.Uri.joinPath(file, '..');
}

export function dissectUri(file:vscode.Uri) : PathDetails {
	const fName = file.path.split('/').pop() ?? '';

	return {
		fileName: fName,
		parent: getParentUri(file,),
		filePureName: fName.replace(c.getFileExtensionRegExp, ''),
		extension: fName.split('.').pop() ?? ''
	};
}

export function getTempFileName(file:vscode.Uri) : string {
	const fd = dissectUri(file);
	return `${fd.filePureName}.${getTempFilePreExtension()}.${fd.extension}`;
}

export function getTempUri(file:vscode.Uri) : vscode.Uri {
	const fd = dissectUri(file);
	return vscode.Uri.joinPath(fd.parent, getTempFileName(file));
}

export function getFileName(file:vscode.Uri): string {
	return dissectUri(file).fileName;
}

export async function openFile(file:vscode.Uri) : Promise<void> {
	await vscode.workspace.openTextDocument(file).then( doc => vscode.window.showTextDocument(doc));
}

export async function callInInteractiveTerminal(command: string, terminal: vscode.Terminal): Promise<vscode.TerminalExitStatus> {
	// wrapper function for terminal call to make it async and 
	// return promise once terminal is closed
	// from https://stackoverflow.com/a/72887036/1716283
	terminal.sendText(command, false);
	terminal.sendText("; exit");
	return new Promise((resolve, reject) => {
		const disposeToken = vscode.window.onDidCloseTerminal(
			(closedTerminal) => {
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
	return path.replace(c.gitExtensionRegExp, '');
}

export async function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

export async function fakeProgressUpdate(progressParameter:Progress, progress: { isDone:boolean }) : Promise<void> {
	let rem = 100;
	while(!progress.isDone) {
		await delay(1000);
		const inc = Math.floor(rem/2.5);
		rem -= inc;
		if (inc > 1) {
			progressParameter.report({ increment: inc});
		}
	}
	return;
}

export async function decryptWithProgressBar(encryptedFile:vscode.Uri, tempFile:vscode.Uri): Promise<void> {
	const parent = getParentUri(encryptedFile);
	const enc = dissectUri(encryptedFile);
	const temp = dissectUri(tempFile);

	// async decrypt with progress bar
	const decryptTerminal = vscode.window.createTerminal({name: c.terminalDecryptName, cwd: parent.fsPath});
	await vscode.window.withProgress(
		{location: vscode.ProgressLocation.Notification, cancellable: false, title: c.decryptionString.replace(c.fileString, enc.fileName)}, 
		async (progress) => {
			progress.report({  increment: 0 });
			const progressDetails = { isDone: false };
			const decryptCommand = c.decryptionCommand.replace(c.fileString, enc.fileName).replace(c.tempFileString, temp.fileName);
			void callInInteractiveTerminal(decryptCommand, decryptTerminal).then(() => {
				progress.report({ increment: 100 });
				progressDetails.isDone = true;
				return;
			});
			await fakeProgressUpdate(progress, progressDetails);			
		}
	);
	return;
}

export function copyEncrypt(extendedTempFile:ExtendedTempFile, terminal: vscode.Terminal) : void {
	fs.copyFileSync(extendedTempFile.tempFile.fsPath, extendedTempFile.originalFile.fsPath);
	executeInTerminal([
		`cd ${getParentUri(extendedTempFile.originalFile).fsPath}`,
		c.encryptionCommand.replace(c.fileString, getFileName(extendedTempFile.originalFile))
	], terminal);
}

export async function isSopsEncrypted(file:vscode.Uri) : Promise<boolean> {
	// go through all regexes in all .sops.yaml files, combine them with 
	// the .sops.yaml file location, and return if given file path matches any
	const sopsFiles =  await vscode.workspace.findFiles(c.sopsYamlGlob);
	for (const sf of sopsFiles) {
		const pr: PatternSet = getSopsPatternsFromFile(sf);
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
	const contentString: string = fs.readFileSync(sopsFile.fsPath, 'utf-8');
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const content = yaml.parse(contentString);
	
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
	const fileRegexes: string[] = content.creation_rules.map((cr:any) => cr.path_regex);
	return [getParentUri(sopsFile).path, fileRegexes];
}

export function getTempFilePreExtension() : string {
	return vscode.workspace.getConfiguration().get<string>('sops-edit.tempFilePreExtension') ?? 'tmp';
}

export function getTempFilePreExtensionRegExp() : RegExp {
	// eslint-disable-next-line no-useless-escape
	return new RegExp(`\.${getTempFilePreExtension()}$`);
}