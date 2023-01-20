import * as vscode from "vscode";
import * as fs from "fs";
import * as yaml from "yaml";
import * as cp from "node:child_process";
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

type Answer = {
	stdout:string,
	stderr:string
};

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
		parent: getParentUri(file),
		filePureName: fName.replace(c.getFileExtensionRegExp, ''),
		extension: fName.split('.').pop() ?? ''
	};
}

export function getTempUri(file:vscode.Uri) : vscode.Uri {
	const fd = dissectUri(file);
	const tempFileName = `${fd.filePureName}.${getTempFilePreExtension()}.${fd.extension}`;
	return vscode.Uri.joinPath(fd.parent, tempFileName);
}

export async function openFile(file:vscode.Uri) : Promise<void> {
	const doc = await vscode.workspace.openTextDocument(file);
	await vscode.window.showTextDocument(doc);
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
		await delay(50);
		const inc = Math.max(Math.floor(rem/20), 1);
		rem -= inc;
		if (rem > 0) {
			progressParameter.report({ increment: inc});
		}
	}
	return;
}

export async function decryptWithProgressBar(encryptedFile:vscode.Uri, tempFile:vscode.Uri): Promise<Answer> {
	const parent = getParentUri(encryptedFile);
	const enc = dissectUri(encryptedFile);
	const temp = dissectUri(tempFile);

	let out:Answer = {stdout:'', stderr:''};

	// async decrypt with progress bar
	await vscode.window.withProgress(
		{location: vscode.ProgressLocation.Notification, cancellable: false, title: c.decryptionString.replace(c.fileString, enc.fileName)}, 
		async (progress) => {
			progress.report({  increment: 0 });
			const progressDetails = { isDone: false };
			const decryptCommand = c.decryptionCommand.replace(c.fileString, enc.fileName).replace(c.tempFileString, temp.fileName);
			cp.exec(decryptCommand, {cwd: parent.fsPath}, (_, stdout, stderr) => {
				out = {stdout:stdout, stderr:stderr};
				progress.report({ increment: 100 });
				progressDetails.isDone = true;
				return;
			});
			await fakeProgressUpdate(progress, progressDetails);			
		}
	);
	return out;
}

export function copyEncrypt(extendedTempFile:ExtendedTempFile) : Answer {
	void fs.copyFileSync(extendedTempFile.tempFile.fsPath, extendedTempFile.originalFile.fsPath);
	const originalFileName = dissectUri(extendedTempFile.originalFile).fileName;
	const cwd = getParentUri(extendedTempFile.originalFile).fsPath;

	// decrypt and return command output
	let out = {stdout:'', stderr:''};
	cp.exec(c.encryptionCommand.replace(c.fileString, originalFileName), {cwd:cwd}, (_, stdout, stderr) => {
		out = {stdout:stdout, stderr:stderr};
	});
	return out;
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
	// open .sops.yaml file, extract path_regex patterns, combine with file location to return a PatternSet
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