exports.activate = activate;
exports.deactivate = deactivate;
import { Selection, ExtensionContext, QuickPick, QuickPickItem, commands, window } from "vscode";
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
    for (let offset = index; offset >= 0; offset--) {
        let char = text.charAt(offset);
        // If it's a quote, we can not infer it is a open or close one
        // so just return, this is for the case current selection is inside a string
        if (bracketUtil.isQuoteBracket(char) && bracketStack.length == 0) {
            return new SearchResult(char, offset);
        }
        if (bracketUtil.isOpenBracket(char)) {
            if (bracketStack.length === 0) {
                return new SearchResult(char, offset);
            }
            else {
                let top = bracketStack.pop();
                if (!bracketUtil.isMatch(char, top)) {
                    if (top === '>') {
                        return new SearchResult(char, offset);
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
    for (let offset = index; offset < text.length; offset++) {
        let char: string = text.charAt(offset);
        // If it's a quote, we can not infer it is a open or close one
        // so just return, this is for the case current selection is inside a string
        if (bracketUtil.isQuoteBracket(char) && bracketStack.length == 0) {
            return new SearchResult(char, offset);
        }
        if (bracketUtil.isCloseBracket(char)) {
            if (bracketStack.length == 0) {
                return new SearchResult(char, offset);
            }
            else {
                let top = bracketStack.pop();
                if (!bracketUtil.isMatch(top, char)) {
                    if (top === '<') {
                        return new SearchResult(char, offset);
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

function findBackwardChar(text: string, seekChar: string, startingOffset: number, isSelecting: boolean) {
    let editor = window.activeTextEditor
    let startSelection = editor.document.positionAt(startingOffset)
    for (let offset = startingOffset; offset >= 0; offset--) {
        let char = text.charAt(offset)
        if (char === seekChar) {
            let openBracketPosition = editor.document.positionAt(offset + 1)
            if (isSelecting) {
                editor.selection = new Selection(startSelection, openBracketPosition);
            }
            else {
                editor.selection = new Selection(openBracketPosition, openBracketPosition);
            }
            return;
        }
    };
}

function findForwardChar(text: string, seekChar: string, startingOffset: number, isSelecting: boolean) {
    let editor = window.activeTextEditor
    let startSelection = editor.document.positionAt(startingOffset)
    for (let offset = startingOffset; offset <= text.length; offset++) {
        let char = text.charAt(offset)
        if (char === seekChar) {
            let openBracketPosition = editor.document.positionAt(offset)
            if (isSelecting) {
                editor.selection = new Selection(startSelection, openBracketPosition);
            }
            else {
                editor.selection = new Selection(openBracketPosition, openBracketPosition);
            }
            return;
        }
    };
}

function isMatch(r1: SearchResult, r2: SearchResult) {
    return r1 && r2 && bracketUtil.isMatch(r1.bracket, r2.bracket);
}

function expandSelection(selection: Selection, includeBracket: boolean) {
    const editor = window.activeTextEditor;
    const text: string = editor.document.getText();
    let selectionStart: number = editor.document.offsetAt(selection.start) - 1; //coverage vscode selection index to text index
    let selectionEnd: number = editor.document.offsetAt(selection.end);


    if (selectionStart < 0 || selectionEnd >= text.length) {
        return;
    }

    let backwardResult = findBackward(text, selectionStart);
    let forwardResult = findForward(text, selectionEnd);

    if (backwardResult === null || forwardResult === null) {
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
        window.showInformationMessage('No matched bracket pairs found');
        return;
    }

    if (includeBracket) {
        return new Selection(editor.document.positionAt(backwardResult.offset),
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

    return new Selection(editor.document.positionAt(selectionStart + 1),
        editor.document.positionAt(selectionEnd));
}

function findWord(selection: Selection) {
    const editor = window.activeTextEditor;
    const text: string = editor.document.getText();
    let selectionStart: number = editor.document.offsetAt(selection.start) - 1; //coverage vscode selection index to text index
    let selectionEnd: number = editor.document.offsetAt(selection.end);

    if (selectionStart < 0 || selectionEnd >= text.length) {
        return;
    }

    let backwardResult: number = (() => {
        for (let offset = selectionStart; offset >= 0; offset--) {
            let char = text.charAt(offset);
            // Find a non alphanum with underscore
            if (!/[a-zA-Z0-9_]/.test(char)) {
                return offset;
            }
        }
    })();
    let forwardResult: number = (() => {
        for (let offset = selectionEnd; offset < text.length; offset++) {
            let char = text.charAt(offset);
            // Find a non alphanum with underscore
            if (!/[a-zA-Z0-9_]/.test(char)) {
                return offset;
            }
        }
    })();

    return new Selection(editor.document.positionAt(backwardResult + 1),
        editor.document.positionAt(forwardResult));
}

function selectContent(isDelete: boolean) {
    const editor = window.activeTextEditor;
    let originSelections = editor.selections;
    let selections = originSelections.map((originSelection) => {
        const newSelect = expandSelection(originSelection, false);
        return newSelect ? newSelect : originSelection;
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
    const editor = window.activeTextEditor;
    let originSelections = editor.selections;
    let selections = originSelections.map((originSelection) => {
        const newSelect = expandSelection(originSelection, true);
        return newSelect ? newSelect : originSelection;
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
    const editor = window.activeTextEditor;
    let originSelections = editor.selections;
    let selections = originSelections.map((originSelection) => {
        const newSelect = findWord(originSelection);
        return newSelect ? newSelect : originSelection;
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

function gotoChar(isGoingForward: boolean) {
    const quickPick: QuickPick<QuickPickItem> = window.createQuickPick();
    if (isGoingForward) {
        quickPick.placeholder = "Going forward";
    }
    else {
        quickPick.placeholder = "Going backward";
    }
    quickPick.prompt = "Enter character you want to jump to";
    quickPick.onDidChangeValue((value) => {
        if (value.length > 1) {
            quickPick.value = value.slice(1, 2);
        }
    })
    quickPick.onDidAccept(() => {
        quickPick.hide();
        const editor = window.activeTextEditor;
        const text = editor.document.getText();
        if (!isGoingForward) {
            let selectionStart: number = editor.document.offsetAt(editor.selection.start) - 1;
            findBackwardChar(text, quickPick.value, selectionStart, false);
        }
        else {
            let selectionEnd: number = editor.document.offsetAt(editor.selection.end);
            findForwardChar(text, quickPick.value, selectionEnd, false);
        }
    });
    quickPick.show();
}

function selectToChar(isGoingForward: boolean) {
    const quickPick: QuickPick<QuickPickItem> = window.createQuickPick();
    if (isGoingForward) {
        quickPick.placeholder = "Going forward";
    }
    else {
        quickPick.placeholder = "Going backward";
    }
    quickPick.prompt = "Enter character you want to jump to";
    quickPick.onDidChangeValue((value) => {
        if (value.length > 1) {
            quickPick.value = value.slice(1, 2);
        }
    })
    quickPick.onDidAccept(() => {
        quickPick.hide();
        const editor = window.activeTextEditor;
        const text = editor.document.getText();
        if (!isGoingForward) {
            let selectionStart: number = editor.document.offsetAt(editor.selection.start);
            findBackwardChar(text, quickPick.value, selectionStart, true);
        }
        else {
            let selectionEnd: number = editor.document.offsetAt(editor.selection.end);
            findForwardChar(text, quickPick.value, selectionEnd, true);
        }
    });
    quickPick.show();
}

function testFunction() {
    console.log('Hi');
}

// Main extension point
export function activate(context: ExtensionContext) {
    context.subscriptions.push(
        commands.registerCommand('bracket-plus-plus.undo-select', history.undoSelect),
        commands.registerCommand('bracket-plus-plus.select-content', selectContent),
        commands.registerCommand('bracket-plus-plus.delete-content', selectContent),
        commands.registerCommand('bracket-plus-plus.select-bracket', selectBracket),
        commands.registerCommand('bracket-plus-plus.delete-bracket', selectBracket),
        commands.registerCommand('bracket-plus-plus.select-word', selectWord),
        commands.registerCommand('bracket-plus-plus.delete-word', selectWord),
        commands.registerCommand('bracket-plus-plus.go-to-char-backward', gotoChar),
        commands.registerCommand('bracket-plus-plus.go-to-char-forward', gotoChar),
        commands.registerCommand('bracket-plus-plus.select-to-char-backward', selectToChar),
        commands.registerCommand('bracket-plus-plus.select-to-char-forward', selectToChar)
    );
}
// This method is called when your extension is deactivated
function deactivate() {
}
//# sourceMappingURL=bracketSelectMain.js.map
