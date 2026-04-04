'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
import * as vscode from 'vscode';
const bracketUtil = require("./bracketUtil");
const history = require("./selectionHistory");

class SearchResult {
    bracket: string
    offset: number

    constructor(bracket: string, offset: number) {
        this.bracket = bracket;
        this.offset = offset;
    }
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

function isMatch(r1: SearchResult, r2: SearchResult) {
    return r1 && r2 && bracketUtil.isMatch(r1.bracket, r2.bracket);
}

function expandSelection(selection: vscode.Selection, includeBracket: boolean) {
    const editor = vscode.window.activeTextEditor;
    let selectionStart: number = editor.document.offsetAt(selection.start) - 1; //coverage vscode selection index to text index
    let selectionEnd: number = editor.document.offsetAt(selection.end);

    const text: string = editor.document.getText();

    if (selectionStart < 0 || selectionEnd >= text.length) {
        return;
    }

    let backwardResult = findBackward(text, selectionStart);
    let forwardResult = findForward(text, selectionEnd);

    if (backwardResult=== null || forwardResult === null)
    {
        return;
    }

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

    if(includeBracket)
    {
        return new vscode.Selection(editor.document.positionAt(backwardResult.offset),
        editor.document.positionAt(forwardResult.offset + 1));
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

function findWord(selection: vscode.Selection) {
    const editor  = vscode.window.activeTextEditor;
    const text: string = editor.document.getText();
    let selectionStart: number = editor.document.offsetAt(selection.start) - 1; //coverage vscode selection index to text index
    let selectionEnd: number = editor.document.offsetAt(selection.end);

    if (selectionStart < 0 || selectionEnd >= text.length) {
        return;
    }

    let backwardResult: number = (() => {
        for (let i = selectionStart; i >= 0; i--) {
        let char = text.charAt(i);
        // Find a non alphanum with underscore
        if (!/[a-zA-Z0-9_]/.test(char)) {
            return i;
        }
    }})();
    let forwardResult: number = (() => {
        for (let i = selectionEnd; i < text.length; i++) {
        let char = text.charAt(i);
        // Find a non alphanum with underscore
        if (!/[a-zA-Z0-9_]/.test(char)) {
            return i;
        }
    }})();

    return new vscode.Selection(editor.document.positionAt(backwardResult + 1),
                                editor.document.positionAt(forwardResult));
}

function selectContent(isDelete: boolean) {
    const editor = vscode.window.activeTextEditor;
    let originSelections = editor.selections;
    let selections = originSelections.map((originSelection) => {
        const newSelect = expandSelection(originSelection, false);
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

function selectBracket(isDelete: boolean) {
    const editor = vscode.window.activeTextEditor;
    let originSelections = editor.selections;
    let selections = originSelections.map((originSelection) => {
        const newSelect = expandSelection(originSelection, true);
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

function selectWord(isDelete: boolean) {
    const editor = vscode.window.activeTextEditor;
    let originSelections = editor.selections;
    let selections = originSelections.map((originSelection) => {
        const newSelect = findWord(originSelection);
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

// Main extension point
export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('bracket-plus-plus.undo-select', history.undoSelect),
        vscode.commands.registerCommand('bracket-plus-plus.select-content', selectContent),
        vscode.commands.registerCommand('bracket-plus-plus.delete-content', selectContent),
        vscode.commands.registerCommand('bracket-plus-plus.select-bracket', selectBracket),
        vscode.commands.registerCommand('bracket-plus-plus.delete-bracket', selectBracket),
        vscode.commands.registerCommand('bracket-plus-plus.select-word',    selectWord),
        vscode.commands.registerCommand('bracket-plus-plus.delete-word',    selectWord)
    );
}
// This method is called when your extension is deactivated
function deactivate() {
}
//# sourceMappingURL=bracketSelectMain.js.map
