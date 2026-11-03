" Syntax for the .ptc language of pb2-trigger-compiler.
if exists('b:current_syntax')
  finish
endif

syntax keyword ptcKeyword var let const extern function export on every if else while for player match break continue return wait import
syntax keyword ptcBoolean true false
syntax match ptcBuiltin /\<\(say\|push\|pop\|clear\|len\|contains\|charAt\|drop\|text\|number\|floor\|round\|random\|slot\|initiator\|name\|team\|time\|chatText\|talker\|talkerName\|sync\|action\)\ze\s*(/
syntax keyword ptcKind region door actor gun barrel vehicle decor pusher light water song timer trigger
syntax match ptcKeyword /\<map\ze\s*{/
syntax match ptcKind /\<\(Door\|Region\|Player\|Actor\|Gun\|Barrel\|Vehicle\|Decor\|Pusher\|Light\|Water\|Song\|Wall\|Background\|EngineMark\)\ze\s*(/
syntax match ptcEventName /\<on\s\+\zs\(start\|join\|chat\)\>/
syntax match ptcNamedValue /\<[A-Z][A-Za-z]*\.[A-Za-z_][A-Za-z0-9_]*\>/
syntax match ptcNumber /\<\d\+\(\.\d\+\)\?\>/
syntax match ptcReference /@[A-Za-z_][A-Za-z0-9_]*/
syntax match ptcOperator /\(\.\.=\?\|=>\|?=\|[-+*/%=!<>]=\?\|&&\|||\)/
syntax region ptcInterpolation matchgroup=ptcDelimiter start=/{/ end=/}/ contained contains=ALLBUT,ptcInterpolation
syntax region ptcString start=/"/ skip=/\\./ end=/"/ contains=ptcInterpolation,ptcEscape
syntax match ptcEscape /\\[n"\\{}]/ contained
syntax match ptcLineComment /\/\/.*$/
syntax region ptcBlockComment start=/\/\*/ end=/\*\//

highlight default link ptcKeyword Keyword
highlight default link ptcBoolean Boolean
highlight default link ptcBuiltin Function
highlight default link ptcKind Type
highlight default link ptcEventName Special
highlight default link ptcNamedValue Constant
highlight default link ptcNumber Number
highlight default link ptcReference Identifier
highlight default link ptcOperator Operator
highlight default link ptcString String
highlight default link ptcEscape SpecialChar
highlight default link ptcDelimiter Delimiter
highlight default link ptcLineComment Comment
highlight default link ptcBlockComment Comment

let b:current_syntax = 'ptc'
