import { TextEditor, commands } from "vscode";
import { isOpenedInPlainTextEditor, isEncryptable, isEncrypted, isTooLargeToConsider} from "./functions";

export class EditorContext {
    public static set(editor:TextEditor|undefined) : void {
        void this._setAsync(editor);
    }

    private static async _setAsync(editor:TextEditor|undefined) : Promise<void> {
        const isOpenedInPlainTextEditorBool = editor ? await isOpenedInPlainTextEditor(editor.document.uri) : false;
        if (!isOpenedInPlainTextEditorBool) {
            void this._setEncryptable(false);
            void this._setEncrypted(false);
            return;
        }

        const isTooLargeToConsiderBool = editor ? await isTooLargeToConsider(editor.document.uri) : false;
        if (isTooLargeToConsiderBool) {
            void this._setEncryptable(false);
            void this._setEncrypted(false);
            return;
        }

        const isEncryptableBool = editor ? await isEncryptable(editor.document.uri) : false;
        if (!isEncryptableBool) {
            void this._setEncryptable(false);
            void this._setEncrypted(false);
            return;
        }
        
        const isEncryptedBool = editor ? isEncrypted(editor.document.uri) : false;
        if (isEncryptableBool) {
            if (isEncryptedBool) {
                void this._setEncryptable(false);
                void this._setEncrypted(true);
                return;
            } else {
                void this._setEncryptable(true);
                void this._setEncrypted(false);
                return;
            }
        }
    }

    private static _setEncryptable(value:boolean) : void {
        void commands.executeCommand('setContext', 'sops-edit.isEncryptable', value ); 
    }
    private static _setEncrypted(value:boolean) : void {
        void commands.executeCommand('setContext', 'sops-edit.isEncrypted', value );
    }
}