; Calls return to the caller; a switch replaces the frame.
start:
    set $log, ""
    set $a, "a"
    set $b, "b"
    set $c, "c"
    call @first
    AddString $log, $c
    call @countdown
    ret
first:
    AddString $log, $a
    jmp @second
second:
    AddString $log, $b
    ret
countdown:
    set $depth, 0
    set $limit, 50
    call @recurse
    ret
recurse:
    add $depth, 1
    jge $depth, $limit, @stop
    call @recurse
stop:
    ret
