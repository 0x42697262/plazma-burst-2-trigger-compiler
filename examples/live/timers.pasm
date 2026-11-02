; A repeating timer with 5 calls.
.timer tick @onTick 3 5
start:
    set $ticks, 0
    ret
onTick:
    add $ticks, 1
