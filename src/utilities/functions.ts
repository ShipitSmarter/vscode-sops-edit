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
	const tempFileName = `${fd.filePureName}.${getSettingTempFilePreExtension()}.${fd.extension}`;
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

export function decryptCommand(files:vscode.Uri[]) : void {
	if (files.length === 0) {
		noFileSelectedErrormessage();
        return;
	}

	void decryptInPlace(files[0]);
}

export function encryptCommand(files:vscode.Uri[]) : void {
	if (files.length === 0) {
		noFileSelectedErrormessage();
        return;
	}

	void encrypt(files[0]);
}

export function noFileSelectedErrormessage() : void {
	void vscode.window.showErrorMessage('Cannot edit file directly: no file selected');
}

export async function decryptInPlace(encryptedFile:vscode.Uri) : Promise<Answer> {
	const enc = dissectUri(encryptedFile);
	const decryptCommand = c.decryptInPlaceCommand.replace(c.fileString, enc.fileName);
	return await decryptWithProgressBar(encryptedFile, decryptCommand);
}

export async function decryptToTmpFile(encryptedFile:vscode.Uri, tempFile:vscode.Uri) : Promise<Answer> {
	const enc = dissectUri(encryptedFile);
	const temp = dissectUri(tempFile);
	const decryptCommand = c.decryptToTmpCommand.replace(c.fileString, enc.fileName).replace(c.tempFileString, temp.fileName);
	return await decryptWithProgressBar(encryptedFile, decryptCommand);
}

export async function decryptWithProgressBar(encryptedFile:vscode.Uri, decryptCommand:string): Promise<Answer> {
	const enc = dissectUri(encryptedFile);

	let out:Answer = {stdout:'', stderr:''};
	await vscode.window.withProgress(
		{location: vscode.ProgressLocation.Notification, cancellable: false, title: c.decryptionString.replace(c.fileString, enc.fileName)}, 
		async (progress) => {
			progress.report({  increment: 0 });
			const progressDetails = { isDone: false };
			cp.exec(decryptCommand, {cwd: enc.parent.fsPath}, (_, stdout, stderr) => {
				out = {stdout:stdout, stderr:stderr};
				progress.report({ increment: 100 });
				progressDetails.isDone = true;
				return;
			});
			await fakeProgressUpdate(progress, progressDetails);			
		}
	);
	if (out.stderr) {
		void vscode.window.showErrorMessage(`Error decrypting ${enc.fileName}: ${out.stderr}`);
	}
	return out;
}

export function copyEncrypt(extendedTempFile:ExtendedTempFile) : Answer {
	void fs.copyFileSync(extendedTempFile.tempFile.fsPath, extendedTempFile.originalFile.fsPath);
	return encrypt(extendedTempFile.originalFile);	
}

export function encrypt(file:vscode.Uri) : Answer {
	const fileDetails = dissectUri(file);
	let out = {stdout:'', stderr:''};
	cp.exec(c.encryptCommand.replace(c.fileString, fileDetails.fileName), {cwd:fileDetails.parent.fsPath}, (_, stdout, stderr) => {
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

export function getSettingTempFilePreExtension() : string {
	return vscode.workspace.getConfiguration().get<string>('sops-edit.tempFilePreExtension') ?? 'tmp';
}

export function getSettingOnlyUseButtons() : boolean {
	return vscode.workspace.getConfiguration().get<boolean>('sops-edit.onlyUseButtons') ?? false;
}

export async function closeFileIfOpen(file:vscode.Uri) : Promise<void> {
	const tabs: vscode.Tab[] = vscode.window.tabGroups.all.map(tg => tg.tabs).flat();
	const index = tabs.findIndex(tab => tab.input instanceof vscode.TabInputText && tab.input.uri.path === file.path);
	if (index !== -1) {
		await vscode.window.tabGroups.close(tabs[index]);
	}
}