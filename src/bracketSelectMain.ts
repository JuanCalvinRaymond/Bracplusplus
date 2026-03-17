'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
// const vscode = require("vscode");
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
function findBackward(text, index) {
    const bracketStack = [];
    for (let i = index; i >= 0; i--) {
        let char = text.charAt(i);
        // if it's a quote, we can not infer it is a open or close one
        //so just return, this is for the case current selection is inside a string;
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
                if(top === '>')
                {
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
    //we are geting to the edge
    return null;
}

function findForward(text, index) {
    const bracketStack = [];
    for (let i = index; i < text.length; i++) {
        let char = text.charAt(i);
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
                  if(top === '<')
                  {
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
        backwardStarter: selectionStart - 1, //coverage vscode selection index to text index
        forwardStarter: selectionEnd,
        text: editor.document.getText()
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

function expandSelection() {
    const editor = vscode.window.activeTextEditor;
    let originSelections = editor.selections;
    let selections = originSelections.map((originSelection) => {
        const newSelect = selectText(originSelection);
        return newSelect ? toVscodeSelection(newSelect) : originSelection;
    });
    let haveChange = selections.findIndex((s, i) => !s.isEqual(originSelections[i])) >= 0;
    if (haveChange) {
        history.changeSelections(selections);
    }
}
function selectText(selection) {
    const searchContext = getSearchContext(selection);
    let { text, backwardStarter, forwardStarter } = searchContext;
    if (backwardStarter < 0 || forwardStarter >= text.length) {
        return;
    }

    var backwardResult = findBackward(searchContext.text, searchContext.backwardStarter);
    var forwardResult = findForward(searchContext.text, searchContext.forwardStarter);
    while (backwardResult != null
      && !isMatch(backwardResult, forwardResult)
      && bracketUtil_1.bracketUtil.isQuoteBracket(backwardResult.bracket)) {
        backwardResult = findBackward(searchContext.text, backwardResult.offset - 1);
    }
    while (forwardResult != null
      && !isMatch(backwardResult, forwardResult)
      && bracketUtil_1.bracketUtil.isQuoteBracket(forwardResult.bracket)) {
        forwardResult = findForward(searchContext.text, forwardResult.offset + 1);
    }

    while (!isMatch(backwardResult, forwardResult)) {
        if(backwardResult.bracket === "<" || bracketUtil_1.bracketUtil.isQuoteBracket(backwardResult.bracket))
        {
            backwardResult = findBackward(searchContext.text, backwardResult.offset - 1);
            continue;
        }
        else if(forwardResult.bracket === ">" || bracketUtil_1.bracketUtil.isQuoteBracket(forwardResult.bracket))
        {
            forwardResult = findForward(searchContext.text, forwardResult.offset + 1);
            continue;
        }
        vscode.window.showInformationMessage('No matched bracket pairs found');
        return;
    }

    let selectionStart, selectionEnd;
    // we are next to a bracket
    // this is the case for double press select
    if (backwardStarter == backwardResult.offset && forwardResult.offset == forwardStarter) {
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
//Main extension point
export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.commands.registerCommand('bracket-plus-plus.select', expandSelection),
      vscode.commands.registerCommand('bracket-plus-plus.undo-select', history.undoSelect)
  );
}
// this method is called when your extension is deactivated
function deactivate() {
}
//# sourceMappingURL=bracketSelectMain.js.map
