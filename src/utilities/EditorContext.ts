import { TextEditor, commands } from "vscode";
import { isOpenedInPlainTextEditor, isEncryptable, isEncrypted, isTooLargeToConsider} from "./functions";
import { FilePool } from "./FilePool";

export class EditorContext {
    public static set(editor:TextEditor|undefined, filePool: FilePool) : void {
        if (editor === undefined || editor === null) {
            this._setButtons(false, false);
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        void this._setAsync(editor!, filePool);
    }

    private static async _setAsync(editor:TextEditor, filePool: FilePool) : Promise<void> {
        if (
            filePool.containsTempFile(editor.document.uri) ||
            (!await isOpenedInPlainTextEditor(editor.document.uri)) ||
            await isTooLargeToConsider(editor.document.uri) ||
            (!await isEncryptable(editor.document.uri))
        ) {
            this._setButtons(false, false);
            return;
        }

        if (isEncrypted(editor.document.uri)) {
            this._setButtons(false, true);
            return;
        } else {
            this._setButtons(true, false);
            return;
        }
    }

    private static _setButtons(encrypt:boolean, decrypt:boolean) {
        void commands.executeCommand('setContext', 'sops-edit.isEncryptable', encrypt ); 
        void commands.executeCommand('setContext', 'sops-edit.isEncrypted', decrypt );
    }
}