; An endless loop that the loop guard stops.
.prefix guard
start:
    set $spins, 0
spin:
    add $spins, 1
    jmp @spin
