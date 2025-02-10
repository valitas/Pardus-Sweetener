There is an unfortunate situation with the audible alarm, and maybe other future
features, that have to be implemented using different APIs in Chrome and
Firefox, and the implementations conflict with each other. Sadly, Pardus
Sweetener can not be fully written in browser-agnostic code, as it once was.

I decided I don't want runtime checks to conditionally choose implementations. I
just don't want polyfills in a Chrome extension checking whether it's running on
Firefox, and vice versa, every time an alarm must sound. The check itself is
overhead, and it imports lots of code that end up not being used.

Instead, we have "chrome" and "firefox" branches of the source tree. Both track
the master branch, and implement the specifics for each browser on top of it.
The master branch implements everything that can be written portably. Features
that require browser-specific code are just mocked up in the master branch, so
that the source directory can be loaded and used unmodified either as a Chrome
"unpacked extension" or a Firefox "temporary add-on".

When fixing bugs or implementing new features, try not to work in a
browser-specific branch, if at all possible, because merging code from one
browser to another, while preserving the bits that need to stay different, is a
headache. Instead, checkout the master branch, and work there. If you write and
test your code in the master branch, then merging it later into the
browser-specific branches is easy.
