import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";

export function escapeHtml(unsafe:string): string {
	// from https://stackoverflow.com/a/6234804/1716283
	return unsafe
		 .replace(/&/g, "&amp;")
		 .replace(/</g, "&lt;")
		 .replace(/>/g, "&gt;")
		 .replace(/"/g, "&quot;")
		 .replace(/'/g, "&#039;");
}

export function removeQuotes(input:string): string {
	let output = input.replace(/^["']/,'').replace(/["']$/,'');
	return output;
}

export function getUri(webview: vscode.Webview, extensionUri: vscode.Uri, pathList: string[]) {
  return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));
}

export async function getWorkspaceFile(matchString: string | vscode.RelativePattern, showErrorMode:string = 'verbose'): Promise<string> {
	// get path to file in workspace
	// suppress ui user error output by setting showErrorMode = 'silent'
	let outPath = '';
	let functionsFiles = await vscode.workspace.findFiles(matchString);
	if (functionsFiles.length > 0) {
		outPath = cleanPath(functionsFiles[0].fsPath);
	} else if (showErrorMode !== 'silent') {
		vscode.window.showErrorMessage('Could not locate file ' + matchString);
	}

	return outPath;
}

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

export function startScript (fileName ?: string , filePath ?: string , command ?: string) : vscode.Terminal {
	let terminal = vscode.window.createTerminal();
	terminal.show();
	//terminal.sendText('Get-Location');
	if (filePath && filePath !== '') {
		terminal.sendText(`cd ${filePath}`);
	};
	
	if (fileName && fileName !== '') {
		terminal.sendText(`./${fileName}`);
	};

	if (command && command !== '') {
		terminal.sendText(command);
	};
	
	return terminal;
}

export function cleanPath (path: string) : string {
	return path.replace(/\\/g, '/');
}

export function parentPath (path: string) : string {
	return path.replace(/\/[^\/]+$/,'');
}

export function nameFromPath (path: string) : string {
	return path.replace(/^[\s\S]*[\/\\]/g,'');
}

export function nth(num:number): string {
	let after:string = '';
	switch (num) {
		case 1 :
		after = 'st';
		break;
		case 2 :
		after = 'nd';
		break;
		case 3 :
		after = 'rd';
		break;
		default:
		after = 'th';
		break;
	}
	return after;
}

export function arrayFrom0(max:number) : number[] {
	// from https://stackoverflow.com/a/33352604/1716283
	return [...Array(max).keys()];
}

export function arrayFrom1(max:number) : number[] {
	return arrayFrom0(max).map(x => ++x);
}

export function toBoolean(string:string) : boolean {
	let outString : boolean = false;
	if (string.toLowerCase() === 'true') {
		outString = true;
	}

	return outString;
}

export function isEmpty(string: string) : boolean {
	return (string === undefined || string === null || string === '');
}

export async function getFileContentFromGlob(glob:string|vscode.RelativePattern) : Promise<string> {
	let content: string = '';
	let path = await getWorkspaceFile(glob);
	if (!isEmpty(path)) {
		content = fs.readFileSync(path, 'utf8');
	}
	return content;
}

export function getDateTimeStamp() : string {
	// create datetimestamp in format YYYYMMDD_hhmmss
	return (new Date()).toISOString().substring(0,19).replace(/[\-:]/g,'').replace(/T/g,'_');
}

export function isFile(path:string) : boolean {
	let isF:boolean = true;
	try {
		fs.lstatSync(path).isFile();
	} catch (err) {
		isF = false;
	}

	return isF;
}

export function isDirectory(path:string) : boolean {
	let isDir:boolean = true;
	try {
		let check:boolean = fs.lstatSync(path).isDirectory();
		isDir = check;
	} catch (err) {
		isDir = false;
	}

	return isDir;
}

export function getButton(id:string, title:string, codicon:string = '',appearance:string = 'primary',hidden:string = '',clas:string = ''): string {
	let codiconString: string = isEmpty(codicon) ? '' : `<span slot="start" class="codicon ${codicon}"></span>`;
	let classString:string = isEmpty(clas) ? '' : `class="${clas}"`;
	let button: string = /*html*/ `
		<vscode-button id="${id}" ${classString} appearance="${appearance}" ${hidden}>
		${title}
		${codiconString}
		</vscode-button>
		`;
	return button;
}

export function forceWriteFileSync(filePath:string, fileContent:string, options:any) {
	const parentDir = parentPath(cleanPath(filePath));
	
	// make parent directory if not exists
	if(!fs.existsSync(parentDir)) {
		fs.mkdirSync(parentDir, { recursive: true });
	}
	
	// write file
	fs.writeFileSync(filePath,fileContent,options);
}

export function cdToLocation(location:string, terminal:vscode.Terminal = vscode.window.createTerminal()) : vscode.Terminal {
	terminal.show();
	terminal.sendText(`cd ${location}`);
	return terminal;
}

export function executeInTerminal(commandArray:string[], terminal:vscode.Terminal = vscode.window.createTerminal()) : vscode.Terminal {
	// execute commands in terminal
	terminal.show();

	for (const psCommand of commandArray) {
		terminal.sendText(psCommand);
	}
	return terminal;
}

export function infoMessage(informationMessage: string = '') {
	if (!isEmpty(informationMessage)) {
		vscode.window.showInformationMessage(informationMessage);
	}
}

export function getCleanFilePathAndName(files:any[]) : {filePath:string, fileName:string, parentPath:string} {
	// get file name and path
	let filesValid = (typeof files !== 'undefined') && (files.length > 0);
	let fp = filesValid ? files[0].fsPath.replace(/\\/g, '/') : '';

	return {
		filePath: fp,
		fileName: fp.split('/').pop() ?? '',
		parentPath: parentPath(fp)
	};
}