import { Uri, Progress, window, ProgressLocation, workspace, Tab, TabInputText } from "vscode";
import { readFileSync, copyFileSync, promises as fspromises } from "fs";
import { EditorContext } from './EditorContext';
import { parse as yamlParse, parseAllDocuments as yamlParseAllDocuments } from "yaml";
import {parse as iniParse} from 'ini';
import { exec } from "node:child_process";
import * as c from "./constants";

type PatternSet = [string, string[]];
type PathDetails = {
	fileName:string, 
	parent:Uri, 
	filePureName:string, 
	extension:string
};
type ProgressBar = Progress<{
    message?: string | undefined;
    increment?: number | undefined;
}>;
type Answer = {
	stdout:string,
	stderr:string
};

export function decryptCommand(files:Uri[]|Uri) : void {
	const file = _getSingleUriFromInput(files);
	if (!file) {
		return;
	}
	void _decryptInPlace(file).then(() => EditorContext.set(window.activeTextEditor));

}

export function encryptCommand(files:Uri[]|Uri) : void {
	const file = _getSingleUriFromInput(files);
	if (!file) {
		return;
	}

	void _encryptInPlaceWithProgressBar(file).then(() => EditorContext.set(window.activeTextEditor));
}

function _getParentUri(file:Uri) : Uri {
	return Uri.joinPath(file, '..');
}

function _dissectUri(file:Uri) : PathDetails {
	const fName = file.path.split('/').pop() ?? '';

	return {
		fileName: fName,
		parent: _getParentUri(file),
		filePureName: fName.replace(c.getFileExtensionRegExp, ''),
		extension: fName.split('.').pop() ?? ''
	};
}

export function getTempUri(file:Uri) : Uri {
	const fd = _dissectUri(file);
	const tempFileName = `${fd.filePureName}.${_getSettingTempFilePreExtension()}.${fd.extension}`;
	return Uri.joinPath(fd.parent, tempFileName);
}

export async function openFile(file:Uri) : Promise<void> {
	const doc = await workspace.openTextDocument(file);
	await window.showTextDocument(doc);
}

export function gitFix(path:string) : string {
	return path.replace(c.gitExtensionRegExp, '');
}

function _executeShellCommand(command:string, cwd:Uri, errorMessage:string) : Answer {
	let out = {stdout:'', stderr:''};
	exec(command, {cwd:cwd.fsPath}, (_, stdout, stderr) => {
		out = {stdout:stdout, stderr:stderr};
	});
	if (out.stderr) {
		void window.showErrorMessage(`${errorMessage}: ${out.stderr}`);
	}
	return out;
}

async function _executeShellCommandWithProgressBar(command:string, cwd:Uri, progressTitle:string, errorMessage:string) : Promise<Answer> {
	// run a shell command and show a moving progress bar in the mean time
	let out:Answer = {stdout:'', stderr:''};
	await window.withProgress(
		{location: ProgressLocation.Notification, cancellable: false, title: progressTitle}, 
		async (progress) => {
			// create progress bar at 0%
			progress.report({  increment: 0 });
			// pointer with 'done' status which will be updated by the command once finished, 
			// and monitored by the progress bar to close once updated 
			const progressDetails = { isDone: false };
			// execute shell command 
			exec(command, {cwd: cwd.fsPath}, (_, stdout, stderr) => {
				// once finished: update 'done' status, close progress bar
				out = {stdout:stdout, stderr:stderr};
				progress.report({ increment: 100 });
				progressDetails.isDone = true;
				return;
			});
			// update progress bar while not done
			await _fakeProgressUpdate(progress, progressDetails);			
		}
	);
	if (out.stderr) {
		void window.showErrorMessage(`${errorMessage}: ${out.stderr}`);
	}
	return out;
}

async function _delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

async function _fakeProgressUpdate(progressBar:ProgressBar, executionStatus: { isDone:boolean }) : Promise<void> {
	// add increments to given progressbar every 50 ms, until external execution is done
	let rem = 100;
	while(!executionStatus.isDone) {
		await _delay(50);
		const inc = Math.max(Math.floor(rem/20), 1);
		rem -= inc;
		if (rem > 0) {
			progressBar.report({ increment: inc});
		}
	}
	return;
}

function _getSingleUriFromInput(input:Uri[]|Uri) : Uri|void {
	let file:Uri;
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
	void window.showErrorMessage('Cannot edit file directly: no file selected');
}

async function _decryptInPlace(encryptedFile:Uri) : Promise<Answer> {
	const enc = _dissectUri(encryptedFile);
	const decryptionCommand = c.decryptInPlaceCommand.replace(c.fileString, enc.fileName);
	const progressTitle = `Decrypting ${enc.fileName} ...`;
	const errorMessage = `Error decrypting ${enc.fileName}`;
	return await _executeShellCommandWithProgressBar(decryptionCommand, enc.parent, progressTitle, errorMessage);
}

export async function decryptToTmpFile(encryptedFile:Uri, tempFile:Uri) : Promise<Answer> {
	const enc = _dissectUri(encryptedFile);
	const temp = _dissectUri(tempFile);
	const decryptionCommand = c.decryptToTmpCommand.replace(c.fileString, enc.fileName).replace(c.tempFileString, temp.fileName);
	const progressTitle = `Decrypting ${enc.fileName} ...`;
	const errorMessage = `Error decrypting ${enc.fileName}`;
	return await _executeShellCommandWithProgressBar(decryptionCommand, enc.parent, progressTitle, errorMessage);
}

export function copyEncrypt(tempFile:Uri, originalFile:Uri) : Answer {
	void copyFileSync(tempFile.fsPath, originalFile.fsPath);
	return _encryptInPlace(originalFile);	
}

function _encryptInPlace(file:Uri) : Answer {
	const fileDetails = _dissectUri(file);
	const command = c.encryptCommand.replace(c.fileString, fileDetails.fileName);
	const errorMessage = `Error encrypting ${fileDetails.fileName}`;
	return _executeShellCommand(command, fileDetails.parent, errorMessage);
}

async function _encryptInPlaceWithProgressBar(file:Uri): Promise<Answer> {
	const fileDetails = _dissectUri(file);
	const command = c.encryptCommand.replace(c.fileString, fileDetails.fileName);
	const progressTitle = `Encrypting ${fileDetails.fileName} ...`;
	const errorMessage = `Error encrypting ${fileDetails.fileName}`;
	return await _executeShellCommandWithProgressBar(command, fileDetails.parent, progressTitle, errorMessage);
}

export async function isOpenedInPlainTextEditor(file:Uri, closeIfOpened = false) : Promise<boolean> {
	const tabs: Tab[] = window.tabGroups.all.map(tg => tg.tabs).flat();
	const index = tabs.findIndex(tab => tab.input instanceof TabInputText && tab.input.uri.path === file.path);
	if (index !== -1 && closeIfOpened) {
		await window.tabGroups.close(tabs[index]);
	}
	return index !== -1;
}

export async function isTooLargeToConsider(file:Uri) : Promise<boolean> {
	const stats = await fspromises.stat(file.fsPath);
	const fileSize = stats.size;
	return fileSize > (1024 * 1024);
}

export async function isEncryptable(file:Uri) : Promise<boolean> {
	// go through all regexes in all .sops.yaml files, combine them with 
	// the .sops.yaml file location, and return if given file path matches any
	const sopsFiles =  await workspace.findFiles(c.sopsYamlGlob);
	for (const sf of sopsFiles) {
		const pr: PatternSet = _getSopsPatternsFromFile(sf);
		for (const re of pr[1]) {
			if (new RegExp(`${pr[0]}/.*${re}`).test(file.path)) {
				return true;
			}
		}
	}
	return false;
}

export function isEncrypted(file:Uri) : boolean {
	// check if file is encrypted by parsing as yaml (or multidocument yaml) and checking for sops property
	const contentString: string = readFileSync(file.fsPath, 'utf-8');
	const extension = _getUriFileExtension(file);

	if (extension === 'ini') {
		return _isEncryptedIniFile(contentString);
	} else if (extension === 'env') {
		return _isEncryptedEnvFile(contentString);
	}
		
	return _isEncryptedYamlFile(contentString);
}

export async function isSopsEncrypted(file:Uri) : Promise<boolean> {
	// check if file is encryptable (i.e. if it matches any regex in any .sops.yaml file),
	// and if so, parse as yaml and check if it has a sops property
	if (!await isEncryptable(file)) {
		return false;
	}

	if (await isTooLargeToConsider(file)) {
		return false;
	}

	return isEncrypted(file);
}

function _isEncryptedYamlFile(contentString:string) : boolean {
	try {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const content = yamlParse(contentString);
		return Object.prototype.hasOwnProperty.call(content, "sops");
	} catch (error) {
		try {
			const documents = yamlParseAllDocuments(contentString);
			for (const doc of documents) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				const content = yamlParse(doc.toString());
				return Object.prototype.hasOwnProperty.call(content, "sops");
			}
		} catch (error) {
			return false;
		}
	}
	return false;
}

function _isEncryptedEnvFile(contentString: string) : boolean {
	return contentString.match(/(^|\r?\n)sops_version=/) !== null;
}

function _isEncryptedIniFile(contentString:string) : boolean {
	try {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
		const content = iniParse(contentString);
		return Object.prototype.hasOwnProperty.call(content, "sops");
	} catch (error) {
		return false;
	}
}

function _getUriFileExtension(file:Uri) : string {
	return file.path.split('.').pop() ?? '';
}

function _getSopsPatternsFromFile(sopsFile:Uri) : PatternSet {
	// open .sops.yaml file, extract path_regex patterns, combine with file location to return a PatternSet
	const contentString: string = readFileSync(sopsFile.fsPath, 'utf-8');
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const content = yamlParse(contentString);
	
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
	const fileRegexes: string[] = content.creation_rules.map((cr:any) => cr.path_regex);
	return [_getParentUri(sopsFile).path, fileRegexes];
}

function _getSettingTempFilePreExtension() : string {
	return workspace.getConfiguration().get<string>('sops-edit.tempFilePreExtension') ?? 'tmp';
}

export function getSettingOnlyUseButtons() : boolean {
	return workspace.getConfiguration().get<boolean>('sops-edit.onlyUseButtons') ?? false;
}