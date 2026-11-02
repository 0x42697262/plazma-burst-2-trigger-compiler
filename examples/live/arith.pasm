; Number and string behavior of the arithmetic actions.
start:
    set $a, 5
    set $b, "5.5"
    set $concat, $b
    VarAddVar $concat, $a
    set $sum, 7
    VarAddValue $sum, 2.5
    VarMultValue $sum, 2
    VarDivValue $sum, 4
    VarSetModuloDivValue $sum, 2
    set $text, "abc"
    VarAddValue $text, 1
    set $negative, 3
    MinusA $negative
    set $literalNegative, -3
    set $literalFloat, 1.5
    set $literalPadded, 007
    set $product, 6
    VarMultVar $product, $a
    set $power, 2
    VarPowValue $power, 10
    set $floored, 7.8
    VarFloor $floored
    set $rounded, 7.5
    VarRound $rounded
    set $ifUndefined, 1
    VarSetValueIfUndefined $ifUndefined, 2
    VarSetValueIfUndefined $fresh, 3
