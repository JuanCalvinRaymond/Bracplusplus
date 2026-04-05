import {Selection, window, TextEditor} from 'vscode';

let selectionHistory: Array<Selection[]> = []
window.onDidChangeActiveTextEditor(() => { selectionHistory = [] })

function selectionLength(editor: TextEditor, selection: Selection): Number {
    return editor.document.offsetAt(selection.end) - editor.document.offsetAt(selection.start);
}

export function changeSelections(selections: Selection[]) {
    let editor: TextEditor = window.activeTextEditor;
    if (selectionHistory.length > 0) {
        //if we can tell that it's a new round of commands, so that will clean the history
        let lastSelections = selectionHistory[selectionHistory.length - 1]
        if (lastSelections.length !== selections.length ||
            // if there is some selection in the new selections that length is smaller than the conrespond selection in the hisory
            lastSelections.findIndex((s, i) => selectionLength(editor, s) > selectionLength(editor, selections[i])) >= 0
        ) {
            selectionHistory = [];
        }
    }

    let originSelections: Selection[] = editor.selections.slice();
    selectionHistory.push(originSelections);
    editor.selections = selections
}

export function undoSelect() {
    let editor = window.activeTextEditor;
    let lastSelections = selectionHistory.pop()
    if (lastSelections) {
        editor.selections = lastSelections;
    }
}
