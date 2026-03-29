// 'use strict';
// Object.defineProperty(exports, "__esModule", { value: true });
// exports.bracketUtil = void 0;
// var bracketUtil;
// (function (bracketUtil) {
let bracketPairs = [
    ["(", ")"],
    ["{", "}"],
    ["[", "]"],
    ["<", ">"],
];
let quoteBrackets = ['"', "'", "`"];
export function isMatch(open, close) {
    if (isQuoteBracket(open)) {
        return open === close;
    }
    return bracketPairs.findIndex(p => p[0] === open && p[1] === close) >= 0;
}
// bracketUtil.isMatch = isMatch;
export function isOpenBracket(char) {
    return bracketPairs.findIndex(pair => pair[0] === char) >= 0;
}
// bracketUtil.isOpenBracket = isOpenBracket;
export function isCloseBracket(char) {
    return bracketPairs.findIndex(pair => pair[1] === char) >= 0;
}
// bracketUtil.isCloseBracket = isCloseBracket;
export function isQuoteBracket(char) {
    return quoteBrackets.indexOf(char) >= 0;
}
    // bracketUtil.isQuoteBracket = isQuoteBracket;
// })(bracketUtil || (exports.bracketUtil = bracketUtil = {}));
//# sourceMappingURL=bracketUtil.js.map
