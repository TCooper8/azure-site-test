($(document).ready(function() {
    //var app = angular.module("AgentLogin", []);

    var ws;
    var usernameInput = $("#usernameInput");
    var passwordInput = $("#passwordInput");
    var loginButton = $("#loginButton");
    var logoutButton = $("#logoutButton");

    var urlIn = location.origin + "/login";
    var urlOut = location.origin + "/logout";

    function toast (msg, duration) {
        Materialize.toast(msg, duration);
    };

    var token;

    var ws = io(location.origin);

    ws.on("loginReply", function (msg) {
        console.log(msg);
        token = msg.token;

        if (msg.status == 200) {
            toast("Logged in!", 5000);
        }
        else {
            toast("Login failed!", 5000);
        }
    });

    ws.on("loginReplyError", function (err) {
        toast("Login failed!", 5000);
        console.log(err);
    });

    ws.on("logoutReply", function(msg) {
        toast("Logged out!", 5000);
        console.log(msg);
    });

    loginButton.click(function() {
        var username = usernameInput.val();
        var password = passwordInput.val();

        var msg = {
            username: username,
            password: password,
            originationIp: "",
            token: token
        };

        toast("Logging in. . . ", 5000);
        ws.emit("login", msg);
    });

    logoutButton.click(function() {
        var msg = {
            token: token
        };

        toast("Logging out. . .", 5000);
        ws.emit("logout", msg);
    });
}));
