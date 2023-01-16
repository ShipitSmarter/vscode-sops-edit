import * as fs from "fs";
import * as yaml from "yaml";
import * as vscode from "vscode";
import * as c from "./constants";

export type PatternSet = [string, string[]];
export type PathDetails = {
	filePath:string, 
	fileName:string, 
	parentPath:string, 
	filePureName:string, 
	extension:string
};

export async function getWorkspaceFiles(matchString: string): Promise<string[]> {
	// get paths to files in workspace that match a glob pattern
	let functionsFiles = await vscode.workspace.findFiles(matchString);
	let outFiles: string[] = [];
	for (let index = 0; index < functionsFiles.length; index++) {
		outFiles[index] = cleanPath(functionsFiles[index].fsPath);
	}
	return outFiles;
}

export function cleanPath (anyPath: string) : string {
	return anyPath.replace(/\\/g, '/').replace('//','/');
}

export function parentPath (filePath: string) : string {
	return filePath.replace(/\/[^\/]+$/,'');
}

export function executeInTerminal(commandArray:string[], terminal:vscode.Terminal = vscode.window.createTerminal()) : vscode.Terminal {
	for (const psCommand of commandArray) {
		terminal.sendText(psCommand);
	}
	return terminal;
}

export function dissectPath(filePath: string) : PathDetails {
	let fPath = cleanPath(filePath);
	let fName = fPath.split('/').pop() ?? '';

	return {
		filePath: fPath,
		fileName: fName,
		parentPath: parentPath(fPath),
		filePureName: fName.replace(/\.[^\.]*$/,''),
		extension: fName.split('.').pop() ?? ''
	};
}

export function copyEncrypt(parentPath:string, fileName:string, tempFileName:string, terminal: vscode.Terminal) : void {
	fs.copyFileSync(`${parentPath}/${tempFileName}`,`${parentPath}/${fileName}`);
	encrypt(fileName, tempFileName, terminal);
}

export function encrypt(fileName:string, tempFileName:string, terminal:vscode.Terminal): void {
	executeInTerminal([replaceInCommand(c.encryptionCommand,fileName,tempFileName)], terminal);
}

export function replaceInCommand(command:string, fileName:string, tempFileName:string) : string {
	return command.replace(c.fileString,fileName).replace(c.tempFileString,tempFileName);
}

export async function fileIsSopsEncrypted(filePath:string) : Promise<boolean> {
	// go through all regexes in all .sops.yaml files, combine them with 
	// the .sops.yaml file location, and return if given file path matches any
	var sopsFiles =  await getWorkspaceFiles(c.sopsYamlGlob);
	for (const sf of sopsFiles) {
		var pr: PatternSet = getSopsPatternsFromFile(sf);
		for (const re of pr[1]) {
			if (new RegExp(`${pr[0]}/.*${re}`).test(filePath)) {
				return true;
			}
		}
	}
	return false;
}

export function getSopsPatternsFromFile(sopsFilePath:string) : PatternSet {
	// open .sops.yaml file, extract path_regex patterns,
	// combine with file location to return a PatternSet
	let sopsFile: PathDetails = dissectPath(sopsFilePath);
	let contentString: string = fs.readFileSync(sopsFilePath,'utf-8');
	let content = yaml.parse(contentString);
	let fileRegexes: string[] = content.creation_rules.map((cr:any) => cr.path_regex);
	return [sopsFile.parentPath, fileRegexes];
}

export async function openFile(filePath:string) : Promise<void> {
	let openPath = vscode.Uri.file(filePath);
	vscode.commands.executeCommand('vscode.open',openPath);
}

export async function callInInteractiveTerminal(command: string, terminal: vscode.Terminal): Promise<vscode.TerminalExitStatus> {
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