import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";

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

export function cleanPath (path: string) : string {
	return path.replace(/\\/g, '/');
}

export function parentPath (path: string) : string {
	return path.replace(/\/[^\/]+$/,'');
}

export function nameFromPath (path: string) : string {
	return path.replace(/^[\s\S]*[\/\\]/g,'');
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

export function infoMessage(informationMessage: string = '') {
	if (!isEmpty(informationMessage)) {
		vscode.window.showInformationMessage(informationMessage);
	}
}

export function dissectPath(files:any[] | string) : {filePath:string, fileName:string, parentPath:string, filePureName:string, extension:string} {
	// interpret arguments
	let fspath: string = '';
	if(Array.isArray(files) && files.length >0) {
		fspath = files[0].fsPath;
	} else if (typeof files === 'string') {
		fspath=  files;
	}

	let fp = fspath.replace(/\\/g, '/');
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