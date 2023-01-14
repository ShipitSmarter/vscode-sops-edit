import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import * as c from "./constants";

export async function getWorkspaceFiles(matchString: string): Promise<string[]> {
	// get path to file in workspace
	let functionsFiles = await vscode.workspace.findFiles(matchString);
	let outFiles: string[] = [];
	for (let index = 0; index < functionsFiles.length; index++) {
		outFiles[index] = cleanPath(functionsFiles[index].fsPath);
	}
	return outFiles;
}

export function getExtensionFile(context: vscode.ExtensionContext, folder: string, file: string): string {
	// get path to file in extension folder
	let fileRawPath = vscode.Uri.file(
		path.join(context.extensionPath, folder, file)
	);

	let filePathEscaped : string = fileRawPath.toString();
	let filePath = vscode.Uri.parse(filePathEscaped).fsPath;
	return filePath;
}

export function cleanPath (path: string) : string {
	return path.replace(/\\/g, '/').replace('//','/').replace(/\.git$/,'');
}

export function parentPath (path: string) : string {
	return path.replace(/\/[^\/]+$/,'');
}

export function cdToLocation(location:string, terminal:vscode.Terminal = vscode.window.createTerminal()) : vscode.Terminal {
	//terminal.show();
	terminal.sendText(`cd ${location}`);
	return terminal;
}

export function executeInTerminal(commandArray:string[], terminal:vscode.Terminal = vscode.window.createTerminal()) : vscode.Terminal {
	// execute commands in terminal
	//terminal.show();

	for (const psCommand of commandArray) {
		terminal.sendText(psCommand);
	}
	return terminal;
}

export function dissectPath(files:any[] | string) : {filePath:string, fileName:string, parentPath:string, filePureName:string, extension:string} {
	// interpret arguments
	let fspath: string = '';
	if(Array.isArray(files) && files.length >0) {
		fspath = files[0].fsPath;
	} else if (typeof files === 'string') {
		fspath=  files;
	}

	let fp = cleanPath(fspath);
	let fn = fp.split('/').pop() ?? '';
	let fpn = fn.replace(/\.[^\.]*$/,'');
	let ext = fn.split('.').pop() ?? '';

	return {
		filePath: fp,
		fileName: fn,
		parentPath: parentPath(fp),
		filePureName: fpn,
		extension: ext
	};
}

export function copyEncrypt(path:string, file:string, tempfile:string, terminal: vscode.Terminal) : void {
	// save to original file and encrypt
	fs.copyFileSync(`${path}/${tempfile}`,`${path}/${file}`);
	encrypt(path, file, terminal);
}

export function encrypt(path:string, file:string, terminal:vscode.Terminal): vscode.Terminal {
	executeInTerminal([`sops -i -e ${file}`], terminal);
	return terminal;
}

export function decrypt(path:string, file:string, tempfile:string): vscode.Terminal {
	let terminal: vscode.Terminal = cdToLocation(path, vscode.window.createTerminal(c.terminalDecryptName));
	executeInTerminal([`sops -d ${file} > ${tempfile}`,'exit'], terminal);
	return terminal;
}

export function fileIsSopsEncrypted(file:string, pathsRegexes: [string, string[]][]) : boolean {
	// go through all regexes in all .sops.yaml files, combine them with 
	// the .sops.yaml file location, and return if given file path matches any
	for (const pr of pathsRegexes) {
		for (const re of pr[1]) {
			if (new RegExp(`${pr[0]}/.*${re}`).test(file)) {
				return true;
			}
		}
	}
	return false;
}