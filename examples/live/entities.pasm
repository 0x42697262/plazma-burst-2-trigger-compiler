; The game reads XML attribute text without decoding entities (F26).
start:
    set $text, "a<b&c"
    CountLength $length, $text
    set $quote, "say \"hi\""
    CountLength $quoteLength, $quote
