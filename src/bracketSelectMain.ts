'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
import * as vscode from 'vscode';
const bracketUtil = require("./bracketUtil");
const history = require("./selectionHistory");

class SearchResult {
    constructor(bracket, offset) {
        this.bracket = bracket;
        this.offset = offset;
    }

    bracket: string
    offset: number
}

function findBackward(text: string, index: number) {
    const bracketStack = [];
    for (let i = index; i >= 0; i--) {
        let char = text.charAt(i);
        // If it's a quote, we can not infer it is a open or close one
        // so just return, this is for the case current selection is inside a string
        if (bracketUtil.isQuoteBracket(char) && bracketStack.length == 0) {
            return new SearchResult(char, i);
        }
        if (bracketUtil.isOpenBracket(char)) {
            if (bracketStack.length === 0) {
                return new SearchResult(char, i);
            }
            else {
                let top = bracketStack.pop();
                if (!bracketUtil.isMatch(char, top)) {
                    if (top === '>') {
                        return new SearchResult(char, i);
                    }
                    throw 'Unmatched bracket pair';
                }
            }
        }
        else if (bracketUtil.isCloseBracket(char)) {
            bracketStack.push(char);
        }
    }
    return null;
}

function findForward(text: string, index: number) {
    const bracketStack = [];
    for (let i = index; i < text.length; i++) {
        let char = text.charAt(i);
        // If it's a quote, we can not infer it is a open or close one
        // so just return, this is for the case current selection is inside a string
        if (bracketUtil.isQuoteBracket(char) && bracketStack.length == 0) {
            return new SearchResult(char, i);
        }
        if (bracketUtil.isCloseBracket(char)) {
            if (bracketStack.length == 0) {
                return new SearchResult(char, i);
            }
            else {
                let top = bracketStack.pop();
                if (!bracketUtil.isMatch(top, char)) {
                    if (top === '<') {
                        return new SearchResult(char, i);
                    }
                    throw 'Unmatched bracket pair';
                }
            }
        }
        else if (bracketUtil.isOpenBracket(char)) {
            bracketStack.push(char);
        }
    }
    return null;
}

function isMatch(r1, r2) {
    return r1 != null && r2 != null && bracketUtil.isMatch(r1.bracket, r2.bracket);
}

function selectText(isDelete: boolean) {
    const editor = vscode.window.activeTextEditor;
    let originSelections = editor.selections;
    let selections = originSelections.map((originSelection) => {
        const newSelect = expandSelection(originSelection);
        return newSelect ? newSelect: originSelection;
    });
    if (isDelete) {
        editor.edit((editBuilder) => {
            selections.forEach(selection => {
                editBuilder.delete(selection);
            });
        });
    }
    else {
        let haveChange = selections.findIndex((s, i) => !s.isEqual(originSelections[i])) >= 0;
        if (haveChange) {
            history.changeSelections(selections);
        }
    }
}


function expandSelection(selection: vscode.Selection) {
    const editor = vscode.window.activeTextEditor;
    let selectionStart: number = editor.document.offsetAt(selection.start);
    let selectionEnd: number = editor.document.offsetAt(selection.end);

    let text: string = editor.document.getText();
    let backwardStarter: number = selectionStart - 1; //coverage vscode selection index to text index
    let forwardStarter: number = selectionEnd

    if (backwardStarter < 0 || forwardStarter >= text.length) {
        return;
    }

    let backwardResult = findBackward(text, backwardStarter);
    let forwardResult = findForward(text, forwardStarter);

    // If the bracker is a quote find matching close or open quote
    while (bracketUtil.isQuoteBracket(backwardResult.bracket) &&
        !isMatch(backwardResult, forwardResult)) {
        backwardResult = findBackward(text, backwardResult.offset - 1);
    }
    while (bracketUtil.isQuoteBracket(forwardResult.bracket) &&
        !isMatch(backwardResult, forwardResult)) {
        forwardResult = findForward(text, forwardResult.offset + 1);
    }

    // Find outer bracket until we find a match.
    // Ignore < > since it can be operator. ex. if(size_t i{0}; i < 10; ++i)
    while (!isMatch(backwardResult, forwardResult)) {
        if (backwardResult.bracket === "<" || bracketUtil.isQuoteBracket(backwardResult.bracket)) {
            backwardResult = findBackward(text, backwardResult.offset - 1);
            continue;
        }
        else if (forwardResult.bracket === ">" || bracketUtil.isQuoteBracket(forwardResult.bracket)) {
            forwardResult = findForward(text, forwardResult.offset + 1);
            continue;
        }
        vscode.window.showInformationMessage('No matched bracket pairs found');
        return;
    }

    // Ignore the whitespace to retain the formatting.
    selectionStart = backwardResult.offset;
    selectionEnd = forwardResult.offset;
    let temp = selectionStart;
    do {
        temp += 1;
    }
    while ((text.charAt(temp) === "\r" || text.charAt(temp) === "\n" || text.charAt(temp) === " ")
        && temp < selectionEnd);

    if (temp < selectionEnd) {

        selectionStart = temp - 1;
    }
    temp = selectionEnd;
    do {
        temp -= 1;
    }
    while ((text.charAt(temp) === "\r" || text.charAt(temp) === "\n" || text.charAt(temp) === " ")
        && temp > selectionStart);

    if (temp > selectionStart) {
        selectionEnd = temp + 1;
    }

    // We are next to a bracket
    // this is the case for double press select
    if (editor.document.offsetAt(selection.start) === selectionStart + 1 &&
        editor.document.offsetAt(selection.end) === selectionEnd) {
        selectionStart = backwardResult.offset - 1;
        selectionEnd = forwardResult.offset + 1;
    }

    return new vscode.Selection(editor.document.positionAt(selectionStart + 1),
        editor.document.positionAt(selectionEnd));
}
// Main extension point
export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('bracket-plus-plus.select', selectText),
        vscode.commands.registerCommand('bracket-plus-plus.undo-select', history.undoSelect),
        vscode.commands.registerCommand('bracket-plus-plus.deleteContent', selectText),
        vscode.commands.registerCommand('bracket-plus-plus.deleteBracket', selectText)
    );
}
// This method is called when your extension is deactivated
function deactivate() {
}
//# sourceMappingURL=bracketSelectMain.js.map
