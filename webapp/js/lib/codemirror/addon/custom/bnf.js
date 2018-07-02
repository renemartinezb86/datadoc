(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
        mod(require("../../lib/codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
        define(["../../lib/codemirror"], mod);
    else // Plain browser env
        mod(CodeMirror);
})(function(CodeMirror) {
    "use strict";

    CodeMirror.defineSimpleMode("text/bnf", {
        start: [
            {regex: /(?:between|or|and|in|like|not|case|insensitive|is|null)\b/i,
                token: "keyword"},
            {regex: /true|false/i,
                token: "atom"},
            {regex: /[-]?(?:\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?[ ]?/i,
                token: "number"},
            {regex: /'(?:[^\\]|\\.)*?'/,
                token: "string"},
            {regex: /("(?:[^\\]|\\.)*?")|[A-z0-9]+/,
                token: "column"},
            {regex: /(?:=|<|>|<=|>=|<>)\b/,
                token: "operator"},
            // autoindentation
            {regex: /\(/, indent: true},
            {regex: /\)/, dedent: true},
        ]
    });
});