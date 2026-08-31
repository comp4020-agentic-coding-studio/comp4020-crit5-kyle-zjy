# Crit 5 reflection

## What was the breakthrough that moved the work forward?

The breakthrough was refusing to let a blocked verification step become a
skipped one. Headless Chromium wouldn't launch in this sandbox
(`libnspr4.so: cannot open shared object file`), and the obvious way out was
to report "typecheck and unit tests pass" as if that were the same claim as
"I watched the game run." It isn't --- the rule tests prove the state machine
is correct, but they say nothing about whether the button actually breathes,
whether the highlight sweep is visible, or whether the end screens are
legible. `apt-get download` (no root needed) plus `dpkg-deb -x` into a scratch
directory got the missing shared libraries extracted without touching the
system, and `LD_LIBRARY_PATH` pointed a real headless browser at them. That
turned up a genuine bug no amount of code-reading would have caught: the win
screen's settled button sat fully opaque, dead centre, directly behind the
stats line. Looking at the actual rendered frame is what found it, and fixing
it before committing is what the automated checks alone could not have forced.

## What did this work change about who I want to be as a software developer?

_Pending --- this is the student's own reflection to write after playing the
built game and living with the result, not something to author on their
behalf. Filling this in honestly requires playing the shipped build first._
