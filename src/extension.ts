import * as vscode from 'vscode';
import * as fs from 'fs';
import * as yaml from 'yaml';
import * as f from './utilities/functions';

export async function activate(context: vscode.ExtensionContext) {
	
	// find all filepath/regex combinations in all .sops.yaml files
	var sopsFiles =  (await f.getWorkspaceFiles('**/*.sops.yaml')).filter(f => !f.includes('/bin/'));
	var pathsRegexes : [string, string[]][] = sopsFiles.map(sfile => {
		let fdetails = f.dissectPath(sfile);
		let contentString: string = fs.readFileSync(sfile,'utf-8');
		let content = yaml.parse(contentString);
		let fileRegexes = content.creation_rules.map((cr:any) => cr.path_regex);
		return [fdetails.parentPath, fileRegexes];
	});

	// let disposable = vscode.commands.registerCommand('vscode-sops-edit.decrypt', (uri, files) => {
	vscode.workspace.onDidOpenTextDocument((openDocument:vscode.TextDocument) => {
		// only apply if this is a sops encrypted file
		let filePath = f.cleanPath(openDocument.fileName);
		if (!fileIsSopsEncrypted(filePath,pathsRegexes) ) {
			return;
		}

		// close the just-opened original document
		vscode.commands.executeCommand("workbench.action.closeActiveEditor");

		// prep
		var fpn = f.dissectPath(openDocument.fileName);
		var [path, filepath, file, purename, ext] = [fpn.parentPath, fpn.filePath, fpn.fileName, fpn.filePureName, fpn.extension ];
		var tempfile = `${purename}.tmp.${ext}`;
		var tempfilepath = `${path}/${tempfile}`;

		// decrypt
		let decryptTerminal: vscode.Terminal = decrypt(path,file, tempfile);
		let encryptTerminal: vscode.Terminal = f.cdToLocation(path,vscode.window.createTerminal('sops'));
		var original:string = '';

		// save and encrypt when tmp file is updated
		vscode.workspace.onDidSaveTextDocument((e:vscode.TextDocument) => {
			let fdetails = f.dissectPath(e.fileName);
			if (fdetails.fileName === tempfile) {
				let contents = e.getText().trim();
				if (contents !== original) {
					original = contents;
					copyEncrypt(path, file, tempfile, encryptTerminal);
				}
			}
		});

		// delete tmp file when closed
		vscode.workspace.onDidCloseTextDocument((e:vscode.TextDocument) => {
			let fdetails = f.dissectPath(e.fileName.replace(/\.git$/,''));
			if (fdetails.fileName === tempfile) {
				f.executeInTerminal(['exit'],encryptTerminal);
				fs.unlinkSync(fdetails.filePath);
			}
		});

		// open tmp file when terminal exits
		vscode.window.onDidCloseTerminal(t => { 
			if (t === decryptTerminal && t.exitStatus) {
				// open
				let openPath = vscode.Uri.file(filepath.replace(file, tempfile));
				// keep original decrypted string for comparison
				original = fs.readFileSync(tempfilepath, 'utf-8').trim();

				// last because asynchronous
				//vscode.workspace.openTextDocument(openPath).then( doc => vscode.window.showTextDocument(doc));
				vscode.commands.executeCommand('vscode.open',openPath);
			}
		}); 
	});

	// context.subscriptions.push(disposable);
}

function copyEncrypt(path:string, file:string, tempfile:string, terminal: vscode.Terminal) : void {
	// save to original file and encrypt
	fs.copyFileSync(`${path}/${tempfile}`,`${path}/${file}`);
	encrypt(path, file, terminal);
}

function encrypt(path:string, file:string, terminal:vscode.Terminal): vscode.Terminal {
	f.executeInTerminal([`sops -i -e ${file}`], terminal);
	return terminal;
}

function decrypt(path:string, file:string, tempfile:string): vscode.Terminal {
	let terminal: vscode.Terminal = f.cdToLocation(path, vscode.window.createTerminal('sops (decrypt)'));
	f.executeInTerminal([`sops -d ${file} > ${tempfile}`,'exit'], terminal);
	return terminal;
}

function fileIsSopsEncrypted(file:string, pathsRegexes: [string, string[]][]) : boolean {
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

// this method is called when your extension is deactivated
export function deactivate() {}
