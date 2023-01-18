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

export type TerminalExtension = {
	terminal: vscode.Terminal,
	filePath: string
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

export function copyEncrypt(parent:vscode.Uri, fileName:string, tempFileName:string, terminal: vscode.Terminal) : void {
	fs.copyFileSync(`${parent.fsPath}/${tempFileName}`,`${parent.fsPath}/${fileName}`);
	encrypt(fileName, tempFileName, terminal);
}

export function encrypt(fileName:string, tempFileName:string, terminal:vscode.Terminal): void {
	executeInTerminal([replaceInCommand(c.encryptionCommand,fileName,tempFileName)], terminal);
}

export function replaceInCommand(command:string, fileName:string, tempFileName:string) : string {
	return command.replace(c.fileString,fileName).replace(c.tempFileString,tempFileName);
}

export async function fileIsSopsEncrypted(file:vscode.Uri) : Promise<boolean> {
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

export function openExistingOrNewTerminal(tempFile: vscode.Uri, name:string, terminals: TerminalExtension[]) : vscode.Terminal {
	if (terminals.map(t => t.filePath).includes(tempFile.path)) {
		return terminals[terminals.findIndex(t => t.filePath === tempFile.path)].terminal;
	} else {
		let terminal = vscode.window.createTerminal({name: name, cwd: getParentUri(tempFile).fsPath});
		terminals.push({terminal:terminal, filePath:tempFile.path});
		return terminal;
	}
}

export function closeTerminalAndRemoveFromList(terminal:vscode.Terminal, tempFile:vscode.Uri,terminals:TerminalExtension[]) : void {
	executeInTerminal(['exit'],terminal);
	if (terminals.map(t => t.filePath).includes(tempFile.path)) {
		terminals.splice(terminals.findIndex(t => t.filePath === tempFile.path),1);
	}
}

export async function callInInteractiveTerminal(command: string, terminal: vscode.Terminal): Promise<vscode.TerminalExitStatus> {
	// wrapper function for terminal call to make it async and 
	// return promise once terminal is closed
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

export function removeElementFromArray(array:any[], element:any) : void {
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