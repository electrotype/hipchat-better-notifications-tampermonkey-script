// ==UserScript==
// @name         HipChat-Better-Notifications
// @namespace    electrotype
// @version      1.0.0
// @description  Better HipChat Notifications
// @author       electrotype
// @match        https://*.hipchat.com/chat
// @match        https://*.hipchat.com/chat/
// @match        https://*.hipchat.com/chat/*
// @grant GM_setValue
// @grant GM_getValue
// @grant GM_addStyle
// @require http://code.jquery.com/jquery-3.2.1.min.js
// ==/UserScript==

//==========================================
// To run this script, Tampermonkey
// is required! https://tampermonkey.net
//
// It works at least on Chrome and Firefox.
// Chrome seems to run HipChat faster.
//
// This script *won't work* as a plain user script in Chrome
// or using Greacemonkey with Firefox.
//
//==========================================
(function () {
    'use strict';

    let isCheckingForNewMessages = true;
    let beforeCheckRoomIndex;

    run();

    //==========================================
    // Makes sur the React application is fully
    // loaded first. Then initializes everything
    // and checks for new messages.
    //==========================================
    function run() {
        let waited = 0;
        let waitedMax = 60 * 1000;
        let wait = 100;
        let startInterval = setInterval(function () {
            waited += wait;
            let roomsContainer = $('.hc-rooms');
            if (roomsContainer.length) {
                clearInterval(startInterval);
                addCheckButton();
                tweakPushState();

                //==========================================
                // Wait for the current page to be ready.
                //==========================================
                waitForPageReady(function () {
                    startCheckingForNewMessages();
                });

            } else if (waited > waitedMax) {
                console.error("Unable to find the initial '.hc-rooms'... HipChat-Better-Notifications won't be started!");
                clearInterval(startInterval);
            }
        }, wait);
    }

    /**
     * Adds a button to manually trigger a check
     * for new messages.
     */
    function addCheckButton() {
        let roomsDiv = $('.hc-rooms');
        roomsDiv.append('<div style="text-align:center; z-index:99999;"><input type="button" value="check messages" id="checkMessagesBtn" /></div>');
        $("#checkMessagesBtn").click(function () {
            $("#checkMessagesBtn").prop("disabled", true);
            startCheckingForNewMessages();
        });
    }

    /**
     * Modifies the "history.pushState" functionnality
     * of the browser to be able to run some commands
     * when the URL changes.
     */
    function tweakPushState() {
        var pushState = history.pushState;
        history.pushState = function () {

            //==========================================
            // We exit a room : set its messages as
            // read before changing the url
            //==========================================
            if (!isCheckingForNewMessages || (beforeCheckRoomIndex === getCurrentRoomIndex())) {
                updateLastMessageReadIdCurrentRoom();
            }

            //==========================================
            // Calls the original function to actually
            // change the url.
            //==========================================
            pushState.apply(history, arguments);

            //==========================================
            // Url is now changes... Custom handling.
            //==========================================
            urlChanged();
        };
    }

    /**
     * Gets the "<li>" elements of all the open rooms,
     * from the sidebar.
     */
    function getOpenRooms() {
        return $(".hc-rooms li.hc-room[draggable='true']");
    }

    /**
     * Returns the "<li>" index of the currently selected room
     * or NULL if none is selected.
     * "0" based.
     */
    function getCurrentRoomIndex() {
        let currentRoomLi = $('.hc-rooms li.aui-nav-selected');
        if (!currentRoomLi.length) {
            return null;
        }

        let index = currentRoomLi.index(".hc-rooms li");
        return index - 1;
    }

    /**
     * Returns the id of the currently selected room
     * or NULL if none is selected.
     */
    function getCurrentRoomId() {

        let url = window.location.href;

        var regex = /.*\/chat\/room\/([\d]+).*/;
        var match = regex.exec(url);
        if (!match || match[1] === null || match[1] === undefined) {
            return null;
        }

        return match[1];
    }

    /**
     * The url has changed!
     */
    function urlChanged() {

        if (isCheckingForNewMessages) {
            return;
        }

        let roomId = getCurrentRoomId();
        if (!roomId) {
            return;
        }

        waitForPageReady(function () {
            updateLastMessageReadIdCurrentRoom();
            removeNotificationCurrentRoom();
        });
    }

    /**
     * Start checking for new messages.
     */
    function startCheckingForNewMessages() {

        let openRooms = getOpenRooms();
        if (openRooms.length === 0) {
            return;
        }

        isCheckingForNewMessages = true;

        let index = getCurrentRoomIndex();
        if (index === null) {
            index = 0;
        }
        beforeCheckRoomIndex = index;

        checkRoomsForNewMessages(0);
    }

    /**
     * Checks if there are new message in rooms.
     * Will be called recursively for all the rooms.
     *
     * @param targetRoomIndex the position of the room in the
     * "open rooms" list to select.
     */
    function checkRoomsForNewMessages(targetRoomIndex) {

        selectRoom(targetRoomIndex, function () {

            //==========================================
            // Validates if the id of the last message in the
            // room indicates that there are unread messages and,
            // if so, displays notifications.
            //==========================================
            checkIfNotificationIsRequired();

            let openRooms = getOpenRooms();
            if ((targetRoomIndex + 1) < openRooms.length) {
                checkRoomsForNewMessages((targetRoomIndex + 1));
            } else {

                selectRoom(beforeCheckRoomIndex, function () {

                    //==========================================
                    // Checking for new messages is done!
                    // We re-select the room which was selected
                    // at the beginning of this process.
                    //==========================================
                    isCheckingForNewMessages = false;
                    updateLastMessageReadIdCurrentRoom();
                    removeNotificationCurrentRoom();
                    $("#checkMessagesBtn").prop("disabled", false);
                });
            }
        });
    }

    /**
     * Selects a room from its index. Waits for it to
     * be ready then call the callback.
     */
    function selectRoom(targetRoomIndex, callback) {

        let startingUrl = window.location.href;

        let startSelectedRoomIndex = getCurrentRoomIndex();
        if (startSelectedRoomIndex !== targetRoomIndex) {
            let room = getOpenRooms().get(targetRoomIndex);
            $(room).find("a").get(0).click();
        }

        //==========================================
        // Waits for the new room to be ready
        //==========================================
        let waited = 0;
        let waitedMax = 10 * 1000;
        let wait = 100;
        let interval = setInterval(function () {
            waited += wait;

            let url = window.location.href;
            let selectedIndex = getCurrentRoomIndex();
            if (startSelectedRoomIndex !== targetRoomIndex && (selectedIndex === null || url === startingUrl)) {

                if (waited > waitedMax) {
                    console.error("Waited too long for the new url!");
                    clearInterval(interval);
                }
                return; // not ready
            }

            clearInterval(interval);

            //==========================================
            // The url is now the correct  one, but we also
            // need to validate that the page is fully loaded.
            //==========================================
            waitForPageReady(callback);
        }, wait);
    }

    /**
     * Check the currently selected room to see if there are
     * unred messages and, if so, adds a notification.
     */
    function checkIfNotificationIsRequired() {

        let lastMessageId = getCurrentRoomLastMessageIdInHtml();
        let lastReadMessageId = getCurrentRoomLastReadMessageId();

        //==========================================
        // Everything already read.
        //==========================================
        if (lastReadMessageId === lastMessageId) {
            return;
        }

        //==========================================
        // New messages! We display a notification...
        //==========================================
        displayNotificationCurrentRoom();
    }

    /**
     * Gets the id of the last message read for the
     * current room.
     */
    function getCurrentRoomLastReadMessageId() {

        let roomId = getCurrentRoomId();
        if (!roomId) {
            return null;
        }

        let store = GM_getValue("store") || {};
        let lastReadMessageId = store[roomId];
        return lastReadMessageId;

    }

    /**
     * Gets the id of the last message of the currently
     * displayed room, using the HTML.
     */
    function getCurrentRoomLastMessageIdInHtml() {

        let messages = $(".hc-messages .hc-chat-msg");
        if (messages.length === 0) {
            return "";
        }
        let lastMessage = messages.last();
        let sendName = $(lastMessage).find(".sender-name").text();
        if (sendName === "HipChat") {
            return "";
        }

        let lastMessagesParts = $(lastMessage).find(".msg-confirmed");
        let lastMessagesPart = lastMessagesParts.last();
        let lastMessageLine = $(lastMessagesPart).find(".msg-line .msg-line");
        let lastMessageId = lastMessageLine.attr("data-mid");

        return lastMessageId;
    }

    /**
     * Displays notifications, since there are new messages in the
     * currently selected room!
     */
    function displayNotificationCurrentRoom() {
        let currentRoomDiv = $(".hc-rooms li.aui-nav-selected");
        let roomName = currentRoomDiv.find(".room-name");
        let roomNameContent = $(roomName).html();
        let pos = roomNameContent.indexOf("<sup");
        if (pos === -1) {
            roomName.html($(roomName).text() + " <sup style='color:#205081;font-weight:bold;background-color:yellow;padding:0px 4px;'> new</sup>");
        }
    }

    /**
     * Removes the notifications of new messages on the
     * currently selected room.
     */
    function removeNotificationCurrentRoom() {

        if (isCheckingForNewMessages) {
            return;
        }

        let currentRoomDiv = $(".hc-rooms li.aui-nav-selected");
        let roomName = currentRoomDiv.find(".room-name");
        let roomNameContent = $(roomName).html();

        let sup = $(roomName).find("sup");
        if (sup.length) {
            fadeOut(sup[0], function () {
                let pos = roomNameContent.indexOf("<sup");
                if (pos > -1) {
                    roomName.html(roomNameContent.substring(0, pos));
                }
            });
        }
    }

    /**
     * Waits for the current room to be ready, then
     * call the callback.
     */
    function waitForPageReady(callback) {

        let waited = 0;
        let waitedMax = 10 * 1000;
        let wait = 100;
        let interval = setInterval(function () {
            waited += wait;
            if ($('.hc-messages .msg-confirmed').length || $('.hc-lobby-panel .hc-lobby-list-item').length || $('.hc-chat-panel-container .empty-msg').length) {
                clearInterval(interval);
                callback();
            } else if (waited > waitedMax) {
                console.error("Unable to find an html element to validate that the page is loaded...");
                clearInterval(interval);
            }
        }, wait);
    }

    /**
     * Updates the store with the id of the last message
     * read on the currently selected room.
     */
    function updateLastMessageReadIdCurrentRoom() {

        if (isCheckingForNewMessages) {
            return;
        }

        let roomId = getCurrentRoomId();
        if (roomId) {

            let lastMessageId = getCurrentRoomLastMessageIdInHtml();
            if (lastMessageId === null) {
                lastMessageId = "";
            }

            let store = GM_getValue("store") || {};
            store[roomId] = lastMessageId;
            GM_setValue("store", store);
        }
    }

    /**
     * Utility : fades out an element.
     */
    function fadeOut(el, callback) {
        el.style.opacity = 1;

        var tick = function () {
            el.style.opacity = +el.style.opacity - 0.02;
            if (+el.style.opacity > 0) {
                if (!(window.requestAnimationFrame && requestAnimationFrame(tick))) {
                    setTimeout(tick, 26);
                }
            } else {
                callback();
            }
        };
        tick();
    }

})();

