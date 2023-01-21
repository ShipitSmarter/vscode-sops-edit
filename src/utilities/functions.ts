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
type ProgressBar = vscode.Progress<{
    message?: string | undefined;
    increment?: number | undefined;
}>;
type Answer = {
	stdout:string,
	stderr:string
};

export function decryptCommand(files:vscode.Uri[]|vscode.Uri) : void {
	const file = getSingleUriFromInput(files);
	if (!file) {
		return;
	}

	void decryptInPlace(file);
}

export function encryptCommand(files:vscode.Uri[]|vscode.Uri) : void {
	const file = getSingleUriFromInput(files);
	if (!file) {
		return;
	}

	void encryptInPlaceWithProgressBar(file);
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

export function executeCommand(command:string, cwd:vscode.Uri, errorMessage:string) : Answer {
	let out = {stdout:'', stderr:''};
	cp.exec(command, {cwd:cwd.fsPath}, (_, stdout, stderr) => {
		out = {stdout:stdout, stderr:stderr};
	});
	if (out.stderr) {
		void vscode.window.showErrorMessage(`${errorMessage}: ${out.stderr}`);
	}
	return out;
}

export async function executeCommandWithProgressBar(command:string, cwd:vscode.Uri, progressTitle:string, errorMessage:string) : Promise<Answer> {
	// run a shell command and show a moving progress bar in the mean time
	let out:Answer = {stdout:'', stderr:''};
	await vscode.window.withProgress(
		{location: vscode.ProgressLocation.Notification, cancellable: false, title: progressTitle}, 
		async (progress) => {
			// create progress bar at 0%
			progress.report({  increment: 0 });
			// pointer with 'done' status which will be updated by the command once finished, 
			// and monitored by the progress bar to close once updated 
			const progressDetails = { isDone: false };
			// execute shell command 
			cp.exec(command, {cwd: cwd.fsPath}, (_, stdout, stderr) => {
				// once finished: update 'done' status, close progress bar
				out = {stdout:stdout, stderr:stderr};
				progress.report({ increment: 100 });
				progressDetails.isDone = true;
				return;
			});
			// update progress bar while not done
			await fakeProgressUpdate(progress, progressDetails);			
		}
	);
	if (out.stderr) {
		void vscode.window.showErrorMessage(`${errorMessage}: ${out.stderr}`);
	}
	return out;
}

export async function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

export async function fakeProgressUpdate(progressBar:ProgressBar, executionStatus: { isDone:boolean }) : Promise<void> {
	// add increments to given progressbar every 50 ms, until external execution is done
	let rem = 100;
	while(!executionStatus.isDone) {
		await delay(50);
		const inc = Math.max(Math.floor(rem/20), 1);
		rem -= inc;
		if (rem > 0) {
			progressBar.report({ increment: inc});
		}
	}
	return;
}

export function getSingleUriFromInput(input:vscode.Uri[]|vscode.Uri) : vscode.Uri|void {
	let file:vscode.Uri;
	if (Array.isArray(input)) {
		if (input.length === 0) {
			noFileSelectedErrormessage();
			return;
		}
		file = input[0];
	} else {
		file = input;
	}

	return file;
}

export function noFileSelectedErrormessage() : void {
	void vscode.window.showErrorMessage('Cannot edit file directly: no file selected');
}

export async function decryptInPlace(encryptedFile:vscode.Uri) : Promise<Answer> {
	const enc = dissectUri(encryptedFile);
	const decryptionCommand = c.decryptInPlaceCommand.replace(c.fileString, enc.fileName);
	const progressTitle = `Decrypting ${enc.fileName} ...`;
	const errorMessage = `Error decrypting ${enc.fileName}`;
	return await executeCommandWithProgressBar(decryptionCommand, enc.parent, progressTitle, errorMessage);
}

export async function decryptToTmpFile(encryptedFile:vscode.Uri, tempFile:vscode.Uri) : Promise<Answer> {
	const enc = dissectUri(encryptedFile);
	const temp = dissectUri(tempFile);
	const decryptionCommand = c.decryptToTmpCommand.replace(c.fileString, enc.fileName).replace(c.tempFileString, temp.fileName);
	const progressTitle = `Decrypting ${enc.fileName} ...`;
	const errorMessage = `Error decrypting ${enc.fileName}`;
	return await executeCommandWithProgressBar(decryptionCommand, enc.parent, progressTitle, errorMessage);
}

export function copyEncrypt(tempFile:vscode.Uri, originalFile:vscode.Uri) : Answer {
	void fs.copyFileSync(tempFile.fsPath, originalFile.fsPath);
	return encryptInPlace(originalFile);	
}

export function encryptInPlace(file:vscode.Uri) : Answer {
	const fileDetails = dissectUri(file);
	const command = c.encryptCommand.replace(c.fileString, fileDetails.fileName);
	const errorMessage = `Error encrypting ${fileDetails.fileName}`;
	return executeCommand(command, fileDetails.parent, errorMessage);
}

export async function encryptInPlaceWithProgressBar(file:vscode.Uri): Promise<Answer> {
	const fileDetails = dissectUri(file);
	const command = c.encryptCommand.replace(c.fileString, fileDetails.fileName);
	const progressTitle = `Encrypting ${fileDetails.fileName} ...`;
	const errorMessage = `Error encrypting ${fileDetails.fileName}`;
	return await executeCommandWithProgressBar(command, fileDetails.parent, progressTitle, errorMessage);
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