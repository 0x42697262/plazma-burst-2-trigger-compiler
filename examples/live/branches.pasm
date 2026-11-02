; Every conditional jump, with variables and literals.
start:
    set $five, 5
    set $six, 6
    set $word, "abc"
    set $numberText, "5"
    set $results, ""
    jeq $five, $five, @eq1
    AddString $results, $no
eq1:
    set $yes, "Y"
    set $no, "N"
    jeq $five, $six, @bad1
    AddString $results, $yes
    jne $five, $six, @ne1
    AddString $results, $no
ne1:
    jlt $five, $six, @lt1
    AddString $results, $no
lt1:
    jlt $six, $five, @bad1
    AddString $results, $yes
    jle $five, 5, @le1
    AddString $results, $no
le1:
    jgt $six, 5, @gt1
    AddString $results, $no
gt1:
    jge $five, $six, @bad1
    AddString $results, $yes
    jeq $word, "abc", @eq2
    AddString $results, $no
eq2:
    jeq $numberText, 5, @eq3
    AddString $results, $no
eq3:
    jne $word, "abd", @ne2
    AddString $results, $no
ne2:
    jgt $word, 1, @bad1
    jle $word, 1, @nan1
    AddString $results, $no
nan1:
    set $done, 1
    ret
bad1:
    set $bad, 1
