; Indirect variables and native arrays.
start:
    set $index, 3
    op326 $slot, "{$cell}{$index}"
    set $value, "stored"
    op342 $slot, $value
    VarSetValueOfVarNamed $loaded, $slot
    op354 $array
    op352 $array, "first"
    op352 $array, "{$value}"
    set $picked, $array
    op350 $picked, "1"
    CountLength $arrayLength, $array
