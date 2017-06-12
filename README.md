# HipChat-Better-Notifications

Tampermonkey script to avoid missing any new message in your HipChat open rooms.

## Why?

[HipChat](https://www.hipchat.com/) notifications are not perfect. I've often clicked on a room on which there was
no notification of any new messages, but there actually were!! I hate missing messages on some rooms I follow...

This script aims to provide better notifications of new messages.

When the HipChat page loads, the script is automatically triggered, will run over all the open rooms and will check if there
are unread messages. It there are in one, it will show a "new!" notification next to the room's name.


## State

This script is very new and basic. First, it only works with the *web* version of HipChat (since Tamperscript is required).
Also, currently, the ids of the latest read messages are stored *locally*. This means that if you browse the same rooms at work
and at home, for example, you will see duplicate "unread" message. I may one day implement a system to save the ids of the read messages
using a GitHub *Gist*. This way, deplicates would be avoided.

Note that even the "check message" button is disabled when the script runs, but you can still click on a room. If you do so, the notifications will
all be wrong! I should add some kind of protection to prevent that.

Please note that the first time you run the script, it will show all open rooms as "containing new messages"... You need to click
on each room to "reset" the state of your read messages. Then you are good to go!

Have fun and don't take this script too seriously...

