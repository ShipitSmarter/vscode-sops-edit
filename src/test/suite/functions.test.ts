import { loadFixture } from '../testHelpers';
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as functions from '../../utilities/functions';
suite('functions', () => {
	void vscode.window.showInformationMessage('Start functions tests.');

    suite('isEncryptedEnvFile', () => {
        test ('should detect encrypted', async () => {
            const contentString = await Promise.resolve(loadFixture('encrypted.env'));
            assert.strictEqual(functions.isEncryptedEnvFile(contentString), true);
        });

        test ('should detect unencrypted', async () => {
            const contentString = await Promise.resolve(loadFixture('unencrypted.env'));
            assert.strictEqual(functions.isEncryptedEnvFile(contentString), false);
        });

    });

    suite('getUriFileExtension', () => {
        test('should detect file extension', () => {
            const file = vscode.Uri.file('a/b/c.txt');
            assert.strictEqual(functions.getUriFileExtension(file), "txt");            
        });
    });
});
