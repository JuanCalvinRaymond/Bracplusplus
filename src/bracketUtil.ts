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
export function isOpenBracket(char) {
    return bracketPairs.findIndex(pair => pair[0] === char) >= 0;
}
export function isCloseBracket(char) {
    return bracketPairs.findIndex(pair => pair[1] === char) >= 0;
}
export function isQuoteBracket(char) {
    return quoteBrackets.indexOf(char) >= 0;
}
//# sourceMappingURL=bracketUtil.js.map
