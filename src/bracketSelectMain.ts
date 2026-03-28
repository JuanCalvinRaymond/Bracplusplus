'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
import * as vscode from 'vscode';
const bracketUtil_1 = require("./bracketUtil");
const history = require("./selectionHistory");

class SearchResult {
    constructor(bracket, offset) {
        this.bracket = bracket;
        this.offset = offset;
    }

    bracket: any
    offset: any
}

function findBackward(text: string, index: number) {
    const bracketStack = [];
    for (let i = index; i >= 0; i--) {
        let char = text.charAt(i);
        // If it's a quote, we can not infer it is a open or close one
        // so just return, this is for the case current selection is inside a string
        if (bracketUtil_1.bracketUtil.isQuoteBracket(char) && bracketStack.length == 0) {
            return new SearchResult(char, i);
        }
        if (bracketUtil_1.bracketUtil.isOpenBracket(char)) {
            if (bracketStack.length === 0) {
                return new SearchResult(char, i);
            }
            else {
                let top = bracketStack.pop();
                if (!bracketUtil_1.bracketUtil.isMatch(char, top)) {
                    if (top === '>') {
                        return new SearchResult(char, i);
                    }
                    throw 'Unmatched bracket pair';
                }
            }
        }
        else if (bracketUtil_1.bracketUtil.isCloseBracket(char)) {
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
        if (bracketUtil_1.bracketUtil.isQuoteBracket(char) && bracketStack.length == 0) {
            return new SearchResult(char, i);
        }
        if (bracketUtil_1.bracketUtil.isCloseBracket(char)) {
            if (bracketStack.length == 0) {
                return new SearchResult(char, i);
            }
            else {
                let top = bracketStack.pop();
                if (!bracketUtil_1.bracketUtil.isMatch(top, char)) {
                    if (top === '<') {
                        return new SearchResult(char, i);
                    }
                    throw 'Unmatched bracket pair';
                }
            }
        }
        else if (bracketUtil_1.bracketUtil.isOpenBracket(char)) {
            bracketStack.push(char);
        }
    }
    return null;
}

function getSearchContext(selection) {
    const editor = vscode.window.activeTextEditor;
    let selectionStart = editor.document.offsetAt(selection.start);
    let selectionEnd = editor.document.offsetAt(selection.end);
    return {
        text: editor.document.getText(),
        backwardStarter: selectionStart - 1, //coverage vscode selection index to text index
        forwardStarter: selectionEnd
    };
}
function toVscodeSelection({ start, end }) {
    const editor = vscode.window.activeTextEditor;
    return new vscode.Selection(editor.document.positionAt(start + 1), //convert text index to vs selection index
        editor.document.positionAt(end));
}

function isMatch(r1, r2) {
    return r1 != null && r2 != null && bracketUtil_1.bracketUtil.isMatch(r1.bracket, r2.bracket);
}

function selectText() {
    const editor = vscode.window.activeTextEditor;
    let originSelections = editor.selections;
    let selections = originSelections.map((originSelection) => {
        const newSelect = expandSelection(originSelection);
        return newSelect ? toVscodeSelection(newSelect) : originSelection;
    });
    let haveChange = selections.findIndex((s, i) => !s.isEqual(originSelections[i])) >= 0;
    if (haveChange) {
        history.changeSelections(selections);
    }
}

function deleteText() {
    const editor = vscode.window.activeTextEditor;
    let originSelections = editor.selections;
    let selections = originSelections.map((originSelection) => {
        const newSelect = expandSelection(originSelection);
        return newSelect ? toVscodeSelection(newSelect) : originSelection;
    });
    editor.edit((editBuilder) => {
        selections.forEach(selection => {
            editBuilder.delete(selection);
        });
    });
}
function expandSelection(selection) {
    const searchContext = getSearchContext(selection);

    var { text, backwardStarter, forwardStarter } = searchContext;
    if (backwardStarter < 0 || forwardStarter >= text.length) {
        return;
    }

    var backwardResult = findBackward(searchContext.text, searchContext.backwardStarter);
    var forwardResult = findForward(searchContext.text, searchContext.forwardStarter);

    // If the bracker is a quote find matching close or open quote
    while (bracketUtil_1.bracketUtil.isQuoteBracket(backwardResult.bracket) &&
        !isMatch(backwardResult, forwardResult)) {
        backwardResult = findBackward(searchContext.text, backwardResult.offset - 1);
    }
    while (bracketUtil_1.bracketUtil.isQuoteBracket(forwardResult.bracket) &&
        !isMatch(backwardResult, forwardResult)) {
        forwardResult = findForward(searchContext.text, forwardResult.offset + 1);
    }

    // Find outer bracket until we find a match.
    // Ignore < > since it can be operator. ex. if(size_t i{0}; i < 10; ++i)
    while (!isMatch(backwardResult, forwardResult)) {
        if (backwardResult.bracket === "<" || bracketUtil_1.bracketUtil.isQuoteBracket(backwardResult.bracket)) {
            backwardResult = findBackward(searchContext.text, backwardResult.offset - 1);
            continue;
        }
        else if (forwardResult.bracket === ">" || bracketUtil_1.bracketUtil.isQuoteBracket(forwardResult.bracket)) {
            forwardResult = findForward(searchContext.text, forwardResult.offset + 1);
            continue;
        }
        vscode.window.showInformationMessage('No matched bracket pairs found');
        return;
    }

    // We are next to a bracket
    // this is the case for double press select
    let selectionStart, selectionEnd;
    if (backwardStarter == backwardResult.offset && forwardStarter == forwardResult.offset) {
        selectionStart = backwardStarter - 1;
        selectionEnd = forwardStarter + 1;
    }
    else {
        selectionStart = backwardResult.offset;
        selectionEnd = forwardResult.offset;

    }

    return {
        start: selectionStart,
        end: selectionEnd,
    };
}
// Main extension point
export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('bracket-plus-plus.select', selectText),
        vscode.commands.registerCommand('bracket-plus-plus.undo-select', history.undoSelect),
        vscode.commands.registerCommand('bracket-plus-plus.deleteContent', deleteText)
    );
}
// This method is called when your extension is deactivated
function deactivate() {
}
//# sourceMappingURL=bracketSelectMain.js.map
