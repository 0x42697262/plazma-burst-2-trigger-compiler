; String actions and variable replacement.
start:
    set $name, "world"
    op326 $greeting, "hello {$name}!"
    set $joined, "ab"
    set $tail, "cd"
    AddString $joined, $tail
    CountLength $length, $joined
    set $hasB, "abcd"
    SetIsAContainsValueB $hasB, "bc"
    set $hasZ, "abcd"
    SetIsAContainsValueB $hasZ, "z"
    set $trimmed, "abcdef"
    op372 2, $trimmed
    set $cut, "abcdef"
    op372 -2, $cut
    set $template, "name={$name}"
    op325 $fromVariable, $template
    set $numberText, 12
    AddString $numberText, $tail
    set $list, "a,b,c"
    op349 $list, ","
    set $separator, "-"
    op405 $list, $separator
