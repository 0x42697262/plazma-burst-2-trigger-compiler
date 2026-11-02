" Syntax for the .pasm assembler of pb2-trigger-compiler.
if exists('b:current_syntax')
  finish
endif

syntax match pasmLabel /^\s*[A-Za-z_][A-Za-z0-9_]*:/
syntax match pasmDirective /^\s*\.[a-z]\+/
syntax keyword pasmInstruction jmp call ret set add say jeq jne jlt jle jgt jge
syntax match pasmVariable /\$[A-Za-z_][A-Za-z0-9_]*/
syntax match pasmHost /%[A-Za-z_][A-Za-z0-9_]*/
syntax match pasmReference /@[A-Za-z_][A-Za-z0-9_]*/
syntax match pasmNumber /-\?\<\d\+\(\.\d\+\)\?\>/
syntax region pasmString start=/"/ skip=/\\./ end=/"/
syntax match pasmComment /\(;\|\/\/\).*$/

highlight default link pasmLabel Label
highlight default link pasmDirective PreProc
highlight default link pasmInstruction Keyword
highlight default link pasmVariable Identifier
highlight default link pasmHost Identifier
highlight default link pasmReference Identifier
highlight default link pasmNumber Number
highlight default link pasmString String
highlight default link pasmComment Comment

let b:current_syntax = 'pasm'
